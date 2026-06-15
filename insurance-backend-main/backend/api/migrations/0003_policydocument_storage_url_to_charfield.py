from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_familysubprofilemanager'),
    ]

    operations = [
        migrations.AlterField(
            model_name='policydocument',
            name='storage_url',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
    ]
