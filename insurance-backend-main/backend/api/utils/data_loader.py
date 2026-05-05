import pandas as pd
import os

# Get the absolute path to the data directory
current_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))), 'data', 'datasets')

#load all csv files from data directory
items = pd.read_csv(os.path.join(data_dir, 'items.csv'))
keywords = pd.read_csv(os.path.join(data_dir, 'keywords.csv'))
merchants = pd.read_csv(os.path.join(data_dir, 'merchants.csv'))
transaction_data = pd.read_csv(os.path.join(data_dir, 'transaction_data.csv'))
transaction_items = pd.read_csv(os.path.join(data_dir, 'transaction_items.csv'))

# Load all datasets
def load_data():
    items = pd.read_csv(os.path.join(data_dir, 'items.csv'))
    keywords = pd.read_csv(os.path.join(data_dir, 'keywords.csv'))
    merchants = pd.read_csv(os.path.join(data_dir, 'merchant.csv'))
    transactions = pd.read_csv(os.path.join(data_dir, 'transaction_data.csv'))
    trans_items = pd.read_csv(os.path.join(data_dir, 'transaction_items.csv'))

    # Convert date columns
    transactions['order_time'] = pd.to_datetime(transactions['order_time'])
    transactions['driver_arrival_time'] = pd.to_datetime(transactions['driver_arrival_time'])
    transactions['driver_pickup_time'] = pd.to_datetime(transactions['driver_pickup_time'])
    transactions['delivery_time'] = pd.to_datetime(transactions['delivery_time'])
    merchants['join_date'] = pd.to_datetime(merchants['join_date'], format='%d%m%Y')
    
    return items, keywords, merchants, transactions, trans_items

def get_popular_order_hours(merchant_id, transactions):
    df = transactions[transactions['merchant_id'] == merchant_id].copy()
    df['order_hour'] = df['order_time'].dt.hour
    return df['order_hour'].value_counts().sort_values(ascending=False).to_dict()

def get_popular_order_days(merchant_id, transactions):
    df = transactions[transactions['merchant_id'] == merchant_id].copy()
    df['order_day'] = df['order_time'].dt.day_name()
    return df['order_day'].value_counts().sort_values(ascending=False).to_dict()

def get_average_basket_size(merchant_id, trans_items, transactions):
    tx = transactions[transactions['merchant_id'] == merchant_id][['order_id']].drop_duplicates()
    item_count = trans_items[trans_items['order_id'].isin(tx['order_id'])]
    avg_basket = item_count.groupby('order_id').size().mean()
    return round(avg_basket, 2)

def get_average_order_value(merchant_id, transactions):
    df = transactions[transactions['merchant_id'] == merchant_id]
    return round(df['order_value'].mean(), 2)

def get_avg_delivery_time(merchant_id, transactions):
    df = transactions[transactions['merchant_id'] == merchant_id].copy()
    df['delivery_duration_min'] = (df['delivery_time'] - df['order_time']).dt.total_seconds() / 60
    return round(df['delivery_duration_min'].mean(), 2)

def get_top_selling_items(merchant_id, trans_items, transactions, items, top_n=5):
    # Merge transaction_items with transaction and item data
    merged = trans_items.merge(transactions[['order_id', 'merchant_id']], on='order_id', how='left')
    merged = merged.merge(items[['item_id', 'item_name', 'merchant_id']], on='item_id', how='left', suffixes=('', '_item'))

    # Filter for merchant
    merchant_items = merged[merged['merchant_id'] == merchant_id]

    # Count sales
    item_sales = merchant_items.groupby(['item_id', 'item_name']).size().reset_index(name='num_sales')
    
    # Sort and return top
    top_items = item_sales.sort_values(by='num_sales', ascending=False).head(top_n)
    return top_items.to_dict(orient='records')

def get_bottom_selling_items(merchant_id, trans_items, transactions, items, bottom_n=5):
    # Merge transaction_items with transaction and item data
    merged = trans_items.merge(transactions[['order_id', 'merchant_id']], on='order_id', how='left')
    merged = merged.merge(items[['item_id', 'item_name', 'merchant_id']], on='item_id', how='left', suffixes=('', '_item'))

    # Filter for merchant
    merchant_items = merged[merged['merchant_id'] == merchant_id]

    # Count sales
    item_sales = merchant_items.groupby(['item_id', 'item_name']).size().reset_index(name='num_sales')
    
    # Sort and return bottom
    bottom_items = item_sales.sort_values(by='num_sales', ascending=True).head(bottom_n)
    return bottom_items.to_dict(orient='records')

# Example usage:
# items, keywords, merchants, transactions, trans_items = load_data()
# print(get_average_basket_size('2a1c4', trans_items, transactions))
# get_top_selling_items('2a1c4', trans_items, transactions, items)