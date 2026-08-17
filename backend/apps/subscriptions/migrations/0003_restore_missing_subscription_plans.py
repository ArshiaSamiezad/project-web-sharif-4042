from django.db import migrations


SILVER_MONTHLY = 99000
GOLD_MONTHLY = 199000

PLANS = (
    {
        'tier': 'basic',
        'name': 'Basic',
        'price_1_month': 0,
        'price_3_months': 0,
        'price_6_months': 0,
        'price_12_months': 0,
        'daily_stream_limit': 60,
        'playlist_limit': 6,
        'can_download': False,
        'can_upload_profile_photo': False,
        'has_early_access': False,
        'has_stats_access': False,
        'is_active': True,
    },
    {
        'tier': 'silver',
        'name': 'Silver',
        'price_1_month': SILVER_MONTHLY,
        'price_3_months': SILVER_MONTHLY * 3,
        'price_6_months': SILVER_MONTHLY * 6,
        'price_12_months': SILVER_MONTHLY * 12,
        'daily_stream_limit': None,
        'playlist_limit': 100,
        'can_download': True,
        'can_upload_profile_photo': True,
        'has_early_access': False,
        'has_stats_access': False,
        'is_active': True,
    },
    {
        'tier': 'gold',
        'name': 'Gold',
        'price_1_month': GOLD_MONTHLY,
        'price_3_months': GOLD_MONTHLY * 3,
        'price_6_months': GOLD_MONTHLY * 6,
        'price_12_months': GOLD_MONTHLY * 12,
        'daily_stream_limit': None,
        'playlist_limit': None,
        'can_download': True,
        'can_upload_profile_photo': True,
        'has_early_access': True,
        'has_stats_access': True,
        'is_active': True,
    },
)


def restore_missing_plans(apps, schema_editor):
    subscription_plan = apps.get_model('subscriptions', 'SubscriptionPlan')
    for plan in PLANS:
        subscription_plan.objects.get_or_create(
            tier=plan['tier'],
            defaults=plan,
        )


class Migration(migrations.Migration):
    dependencies = [
        ('subscriptions', '0002_seed_initial_plans'),
    ]

    operations = [
        migrations.RunPython(restore_missing_plans, migrations.RunPython.noop),
    ]
