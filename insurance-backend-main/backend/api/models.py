import uuid
from django.db import models


class FamilySubProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_supabase_uid = models.UUIDField(db_index=True)
    full_name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=60)
    date_of_birth = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} ({self.relationship})"


class PolicyDocument(models.Model):
    TYPE_CHOICES = [
        ("life", "Life"),
        ("medical", "Medical"),
        ("motor", "Motor"),
        ("travel", "Travel"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sub_profile = models.ForeignKey(
        FamilySubProfile, on_delete=models.CASCADE, related_name="policies"
    )
    title = models.CharField(max_length=200)
    insurance_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="other")
    provider = models.CharField(max_length=120, blank=True)
    storage_url = models.URLField()
    metadata = models.JSONField(default=dict, blank=True)
    uploaded_by_supabase_uid = models.UUIDField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class PolicyShare(models.Model):
    PERMISSION_CHOICES = [
        ("view", "View"),
        ("claim_support", "Claim Support"),
        ("manage", "Manage"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    policy = models.ForeignKey(
        PolicyDocument, on_delete=models.CASCADE, related_name="shares"
    )
    shared_with_supabase_uid = models.UUIDField(db_index=True)
    shared_by_supabase_uid = models.UUIDField(db_index=True)
    permission = models.CharField(max_length=20, choices=PERMISSION_CHOICES, default="view")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("policy", "shared_with_supabase_uid")


class FamilySubProfileManager(models.Model):
    PERMISSION_CHOICES = [
        ("view", "View"),
        ("claim_support", "Claim Support"),
        ("manage", "Manage"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sub_profile = models.ForeignKey(
        FamilySubProfile, on_delete=models.CASCADE, related_name="managers"
    )
    manager_supabase_uid = models.UUIDField(db_index=True)
    granted_by_supabase_uid = models.UUIDField(db_index=True)
    permission = models.CharField(max_length=20, choices=PERMISSION_CHOICES, default="manage")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("sub_profile", "manager_supabase_uid")

