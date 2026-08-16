from django.db import migrations


# منبع قیمت پایه (۱ ماهه) Silver/Gold: مقادیر DEFAULT_SUBSCRIPTION_PRICES
# در src/data/seed.js (فرانت‌اند همین Repository) -> silver: 99000, gold: 199000.
# این تنها قیمت رسمی موجود در پروژه است، اما آن‌جا فقط یک قیمت واحد (نه
# به تفکیک ۱/۳/۶/۱۲ ماه) نگه‌داری می‌شود. قیمت‌های ۳/۶/۱۲ ماهه در هیچ‌جای
# Repository یا صورت پروژه مشخص نشده‌اند؛ این‌جا با ضرب ساده در تعداد ماه
# (بدون هیچ تخفیف پلکانی) به‌عنوان Placeholder محاسبه شده‌اند، چون تصمیم
# درباره تخفیف دوره‌های بلندتر قبلاً به‌عنوان یک تصمیم باز به تیم/TA
# موکول شده بود. این مقادیر باید بعداً توسط تیم/Admin بازبینی و در صورت
# نیاز عوض شوند.
SILVER_MONTHLY = 99000
GOLD_MONTHLY = 199000

PLANS = [
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
        'price_1_month': SILVER_MONTHLY * 1,
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
        'price_1_month': GOLD_MONTHLY * 1,
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
]


def seed_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model('subscriptions', 'SubscriptionPlan')
    for plan_data in PLANS:
        tier = plan_data['tier']
        # get_or_create روی tier (unique) => اجرای دوباره این Migration
        # روی یک Database که این رکوردها را از قبل دارد، رکورد تکراری
        # نمی‌سازد و مقادیر رکورد موجود را هم دست نمی‌زند.
        SubscriptionPlan.objects.get_or_create(
            tier=tier,
            defaults=plan_data,
        )


def unseed_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model('subscriptions', 'SubscriptionPlan')
    tiers = [plan_data['tier'] for plan_data in PLANS]
    SubscriptionPlan.objects.filter(tier__in=tiers).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('subscriptions', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_plans, reverse_code=unseed_plans),
    ]
