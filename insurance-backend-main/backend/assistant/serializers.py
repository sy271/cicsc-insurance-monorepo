from rest_framework import serializers
from .models import SellerProfile, Product, Order, SalesAnalytics, Anomaly

class SellerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerProfile
        fields = ['shop_name', 'shop_rating', 'total_sales', 'total_products', 'created_at']

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'stock', 'sales_count', 'rating', 'created_at']

class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['order_id', 'total_amount', 'status', 'created_at']

class SalesAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesAnalytics
        fields = ['date', 'total_sales', 'total_orders', 'average_order_value', 'conversion_rate']

class AnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model = Anomaly
        fields = ['type', 'description', 'severity', 'is_resolved', 'created_at'] 