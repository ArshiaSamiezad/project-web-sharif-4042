from django.db import models

from apps.users.models import User


class SubscriptionPlan(models.Model):
    """
    یک پلن اشتراک (Basic / Silver / Gold).

    Basic هم یک رکورد در همین جدول است (با قیمت صفر) تا محدودیت‌ها و
    قابلیت‌های هر سه سطح از یک منبع واحد خوانده شوند و منطق پروژه به
    شرط‌های پراکنده (if tier == 'basic': ...) وابسته نشود.

    Convention برای «نامحدود»:
    برای daily_stream_limit و playlist_limit مقدار None (یعنی NULL در
    دیتابیس) به معنای «بدون محدودیت» است. مقدار صفر یا هر عدد مثبت یعنی
    سقف واقعی همان عدد است. این Convention با رفتار موجود پروژه سازگار
    است، چون فیلدهای nullable مشابه (مثل Album.album روی Track) از قبل
    در Repository برای «مقدار می‌تواند وجود نداشته باشد» استفاده شده‌اند.
    """

    class Tier(models.TextChoices):
        BASIC = 'basic', 'Basic'
        SILVER = 'silver', 'Silver'
        GOLD = 'gold', 'Gold'

    tier = models.CharField(max_length=20, choices=Tier.choices, unique=True)
    name = models.CharField(max_length=80)

    # قیمت‌ها مستقل برای هر بازه، نه یک قیمت ماهانه ضرب‌شده؛ چون تخفیف
    # پلکانی برای دوره‌های بلندتر ممکن است بعداً اعمال شود.
    price_1_month = models.PositiveIntegerField(default=0)
    price_3_months = models.PositiveIntegerField(default=0)
    price_6_months = models.PositiveIntegerField(default=0)
    price_12_months = models.PositiveIntegerField(default=0)

    # None = نامحدود (به توضیح بالای کلاس نگاه کنید)
    daily_stream_limit = models.PositiveIntegerField(null=True, blank=True)
    playlist_limit = models.PositiveIntegerField(null=True, blank=True)

    can_download = models.BooleanField(default=False)
    can_upload_profile_photo = models.BooleanField(default=False)
    has_early_access = models.BooleanField(default=False)
    has_stats_access = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.name


class UserSubscription(models.Model):
    """
    یک دوره اشتراک برای یک کاربر. هر کاربر می‌تواند در طول زمان چند
    UserSubscription داشته باشد (تاریخچه کامل حفظ می‌شود، رکوردها هرگز
    حذف نمی‌شوند).

    در این مرحله فقط Schema ایجاد شده است؛ منطق فعال‌سازی، انقضا و
    تمدید و همچنین قاعده «فقط یک اشتراک Active در هر لحظه» در مرحله
    Business Logic پیاده‌سازی خواهد شد. status و created_at طوری
    طراحی شده‌اند که آن منطق بعداً بدون تغییر Schema قابل افزودن باشد.
    """

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        EXPIRED = 'expired', 'Expired'
        CANCELLED = 'cancelled', 'Cancelled'

    # on_delete=PROTECT (نه CASCADE مثل Album/Track/Playlist): حذف یک
    # User نباید به‌صورت خودکار تاریخچه اشتراک را از بین ببرد. تاریخچه
    # اشتراک ماهیتی متفاوت از محتوای تولیدی (آلبوم/ترک/پلی‌لیست) دارد و
    # حذف پنهان آن رفتار غیرمنتظره محسوب می‌شود؛ در پروژه فعلی مسیر
    # حذف کاربر اصلاً پیاده نشده (UserViewSet فقط Read-only است)، پس
    # این تصمیم چیزی را در عمل قفل نمی‌کند.
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='subscriptions',
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name='user_subscriptions',
    )

    start_date = models.DateField()
    end_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date', '-id']
        indexes = [
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.plan.tier}:{self.status}'


class Transaction(models.Model):
    """
    یک تلاش پرداخت (موفق، ناموفق یا در انتظار).

    Flow (طبق طراحی قبلی، هنوز پیاده‌سازی نشده): ابتدا Transaction با
    status=Pending ساخته می‌شود؛ فقط بعد از Success یک UserSubscription
    ساخته یا تمدید و به user_subscription همین رکورد وصل می‌شود. به
    همین دلیل user_subscription در این‌جا nullable است.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'

    class Duration(models.IntegerChoices):
        ONE_MONTH = 1, '1 Month'
        THREE_MONTHS = 3, '3 Months'
        SIX_MONTHS = 6, '6 Months'
        TWELVE_MONTHS = 12, '12 Months'

    # on_delete=PROTECT: مشابه UserSubscription، رکورد مالی نباید با
    # حذف کاربر ناپدید شود.
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='transactions',
    )

    # ارجاع به پلن فقط برای فیلتر/گزارش‌گیری است؛ منبع مبلغ واقعی
    # فیلد amount (Snapshot شده) در همین مدل است، نه plan.price_*.
    # PROTECT تا حذف یک Plan دارای تاریخچه تراکنش ممکن نباشد.
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name='transactions',
    )

    # Snapshot از سطح پلن در لحظه خرید؛ حتی اگر tier همان plan بعداً
    # از طریق تغییر یا رکورد جایگزین دیگرگون شود، این مقدار عوض نمی‌شود.
    plan_tier_snapshot = models.CharField(
        max_length=20,
        choices=SubscriptionPlan.Tier.choices,
    )

    duration_months = models.PositiveSmallIntegerField(choices=Duration.choices)

    # Snapshot مستقل مبلغ نهایی؛ تغییر بعدی price_* روی Plan هیچ اثری
    # روی این مقدار ندارد.
    amount = models.PositiveIntegerField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    gateway_reference_id = models.CharField(max_length=200, blank=True, default='')

    # فقط بعد از پرداخت موفق پر می‌شود؛ SET_NULL تا اگر (در آینده و
    # خارج از رفتار عادی) رکورد UserSubscription مرتبط از بین رفت،
    # خودِ رکورد مالی Transaction همچنان به‌عنوان سند باقی بماند.
    user_subscription = models.ForeignKey(
        UserSubscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self):
        return f'{self.user_id}:{self.plan_tier_snapshot}:{self.status}'
