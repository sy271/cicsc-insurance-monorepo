from django.db import models
from django.contrib.auth.models import User

class SellerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    shop_name = models.CharField(max_length=100)
    shop_rating = models.FloatField(default=0.0)
    total_sales = models.IntegerField(default=0)
    total_products = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.shop_name

class Product(models.Model):
    seller = models.ForeignKey(SellerProfile, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    sales_count = models.IntegerField(default=0)
    rating = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Order(models.Model):
    ORDER_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    
    seller = models.ForeignKey(SellerProfile, on_delete=models.CASCADE)
    order_id = models.CharField(max_length=50, unique=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order {self.order_id}"

class SalesAnalytics(models.Model):
    seller = models.ForeignKey(SellerProfile, on_delete=models.CASCADE)
    date = models.DateField()
    total_sales = models.DecimalField(max_digits=10, decimal_places=2)
    total_orders = models.IntegerField()
    average_order_value = models.DecimalField(max_digits=10, decimal_places=2)
    conversion_rate = models.FloatField()

    class Meta:
        unique_together = ('seller', 'date')

    def __str__(self):
        return f"Sales Analytics for {self.seller.shop_name} on {self.date}"

class Anomaly(models.Model):
    ANOMALY_TYPES = [
        ('sales_drop', 'Sales Drop'),
        ('stock_low', 'Low Stock'),
        ('rating_drop', 'Rating Drop'),
        ('order_issue', 'Order Issue'),
    ]
    
    seller = models.ForeignKey(SellerProfile, on_delete=models.CASCADE)
    type = models.CharField(max_length=20, choices=ANOMALY_TYPES)
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High')])
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_type_display()} Anomaly for {self.seller.shop_name}" 