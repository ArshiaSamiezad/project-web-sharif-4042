import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name="Ticket", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("subject", models.CharField(max_length=160)), ("status", models.CharField(choices=[("open", "Open"), ("in_progress", "In progress"), ("closed", "Closed")], db_index=True, default="open", max_length=16)),
            ("priority", models.CharField(choices=[("low", "Low"), ("normal", "Normal"), ("high", "High")], default="normal", max_length=10)),
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("assigned_to", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_tickets", to=settings.AUTH_USER_MODEL)),
            ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tickets", to=settings.AUTH_USER_MODEL)),
        ]),
        migrations.CreateModel(name="TicketMessage", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("body", models.TextField()), ("created_at", models.DateTimeField(auto_now_add=True)),
            ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="support.ticket")),
        ]),
    ]
