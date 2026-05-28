from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Avg, Count
from datetime import timedelta
from .models import SellerProfile, Product, Order, SalesAnalytics, Anomaly
from .serializers import (
    SellerProfileSerializer, ProductSerializer, OrderSerializer,
    SalesAnalyticsSerializer, AnomalySerializer
)

class SellerProfileViewSet(viewsets.ModelViewSet):
    queryset = SellerProfile.objects.all()
    serializer_class = SellerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SellerProfile.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        seller = self.get_queryset().first()
        if not seller:
            return Response({"error": "Seller profile not found"}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.now().date()
        analytics = SalesAnalytics.objects.filter(seller=seller, date=today).first()
        anomalies = Anomaly.objects.filter(seller=seller, is_resolved=False)
        
        data = {
            "shop_name": seller.shop_name,
            "total_sales": seller.total_sales,
            "total_products": seller.total_products,
            "shop_rating": seller.shop_rating,
            "today_stats": SalesAnalyticsSerializer(analytics).data if analytics else None,
            "active_anomalies": AnomalySerializer(anomalies, many=True).data
        }
        
        return Response(data)

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        seller = SellerProfile.objects.filter(user=self.request.user).first()
        if not seller:
            return Product.objects.none()
        return Product.objects.filter(seller=seller)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        products = self.get_queryset().filter(stock__lt=10)
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        seller = SellerProfile.objects.filter(user=self.request.user).first()
        if not seller:
            return Order.objects.none()
        return Order.objects.filter(seller=seller)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in dict(Order.ORDER_STATUS_CHOICES):
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        
        order.status = new_status
        order.save()
        return Response(OrderSerializer(order).data)

class SalesAnalyticsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SalesAnalytics.objects.all()
    serializer_class = SalesAnalyticsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        seller = SellerProfile.objects.filter(user=self.request.user).first()
        if not seller:
            return SalesAnalytics.objects.none()
        return SalesAnalytics.objects.filter(seller=seller)

    @action(detail=False, methods=['get'])
    def daily_stats(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        queryset = self.get_queryset()
        if start_date and end_date:
            queryset = queryset.filter(date__range=[start_date, end_date])
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

class AnomalyViewSet(viewsets.ModelViewSet):
    queryset = Anomaly.objects.all()
    serializer_class = AnomalySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        seller = SellerProfile.objects.filter(user=self.request.user).first()
        if not seller:
            return Anomaly.objects.none()
        return Anomaly.objects.filter(seller=seller)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        anomaly = self.get_object()
        anomaly.is_resolved = True
        anomaly.save()
        return Response(AnomalySerializer(anomaly).data)

class MerchantInsightsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_seller(self):
        return SellerProfile.objects.filter(user=self.request.user).first()

    @action(detail=False, methods=['get'])
    def insights(self, request):
        seller = self.get_seller()
        if not seller:
            return Response({"error": "Seller profile not found"}, status=status.HTTP_404_NOT_FOUND)

        # Get date range
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=30)

        # Get sales analytics for the period
        sales_analytics = SalesAnalytics.objects.filter(
            seller=seller,
            date__range=[start_date, end_date]
        ).aggregate(
            total_revenue=Sum('total_sales'),
            total_orders=Sum('total_orders'),
            avg_order_value=Avg('average_order_value'),
            avg_conversion_rate=Avg('conversion_rate')
        )

        # Get product insights
        product_insights = Product.objects.filter(seller=seller).aggregate(
            total_products=Count('id'),
            low_stock_products=Count('id', filter=models.Q(stock__lt=10)),
            avg_rating=Avg('rating')
        )

        # Get order status distribution
        order_status = Order.objects.filter(seller=seller).values('status').annotate(
            count=Count('id')
        )

        # Get active anomalies
        active_anomalies = Anomaly.objects.filter(
            seller=seller,
            is_resolved=False
        ).values('type', 'severity').annotate(
            count=Count('id')
        )

        insights_data = {
            "sales_metrics": {
                "total_revenue": sales_analytics['total_revenue'] or 0,
                "total_orders": sales_analytics['total_orders'] or 0,
                "average_order_value": sales_analytics['avg_order_value'] or 0,
                "conversion_rate": sales_analytics['avg_conversion_rate'] or 0
            },
            "product_metrics": {
                "total_products": product_insights['total_products'],
                "low_stock_products": product_insights['low_stock_products'],
                "average_rating": product_insights['avg_rating'] or 0
            },
            "order_distribution": {
                status['status']: status['count'] for status in order_status
            },
            "active_anomalies": {
                f"{anomaly['type']}_{anomaly['severity']}": anomaly['count']
                for anomaly in active_anomalies
            }
        }

        return Response(insights_data) 