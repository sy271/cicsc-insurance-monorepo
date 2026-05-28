from rest_framework import serializers
from .models import FamilySubProfile, PolicyDocument, PolicyShare


class FamilySubProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilySubProfile
        fields = "__all__"
        read_only_fields = ("id", "owner_supabase_uid", "created_at", "updated_at")


class PolicyDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PolicyDocument
        fields = "__all__"
        read_only_fields = ("id", "uploaded_by_supabase_uid", "created_at")


class PolicyShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = PolicyShare
        fields = "__all__"
        read_only_fields = ("id", "shared_by_supabase_uid", "created_at")

