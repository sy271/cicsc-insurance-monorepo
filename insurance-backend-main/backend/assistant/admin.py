from django.contrib import admin
from .models import SellerProfile, Product, Order, SalesAnalytics, Anomaly

@admin.register(SellerProfile)
class SellerProfileAdmin(admin.ModelAdmin):
    list_display = ('shop_name', 'shop_rating', 'total_sales', 'total_products')
    search_fields = ('shop_name',)

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'stock', 'sales_count', 'rating')
    list_filter = ('seller',)
    search_fields = ('name',)

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'seller', 'total_amount', 'status', 'created_at')
    list_filter = ('status', 'seller')
    search_fields = ('order_id',)

@admin.register(SalesAnalytics)
class SalesAnalyticsAdmin(admin.ModelAdmin):
    list_display = ('seller', 'date', 'total_sales', 'total_orders')
    list_filter = ('date', 'seller')
    date_hierarchy = 'date'

@admin.register(Anomaly)
class AnomalyAdmin(admin.ModelAdmin):
    list_display = ('seller', 'type', 'severity', 'is_resolved', 'created_at')
    list_filter = ('type', 'severity', 'is_resolved')
    search_fields = ('description',) 