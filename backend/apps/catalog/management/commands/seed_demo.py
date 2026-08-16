from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import Album, Track
from apps.playlists.models import Playlist, PlaylistTrack
from apps.users.models import User


AuthUser = get_user_model()


SAMPLE_AUDIO = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
]


def cover(seed):
    return f'https://picsum.photos/seed/sepatify-{seed}/400/400'


class Command(BaseCommand):
    help = 'Seed demo users, albums, tracks, and playlists aligned with the frontend.'

    @transaction.atomic
    def handle(self, *args, **options):
        PlaylistTrack.objects.all().delete()
        Playlist.objects.all().delete()
        Track.objects.all().delete()
        Album.objects.all().delete()
        User.objects.all().delete()

        listener = User.objects.create(
            email='listener@sepatify.test',
            display_name='شنونده نمونه',
            username='user_listen',
            role=User.Role.LISTENER,
            subscription=User.Subscription.BASIC,
        )
        gold = User.objects.create(
            email='gold@sepatify.test',
            display_name='کاربر طلایی',
            username='user_gold',
            role=User.Role.LISTENER,
            subscription=User.Subscription.GOLD,
        )
        artist = User.objects.create(
            email='artist@sepatify.test',
            display_name='هنرمند نمونه',
            username='user_artist',
            role=User.Role.ARTIST,
            artist_name='هنرمند نمونه',
            status=User.Status.APPROVED,
            subscription=User.Subscription.BASIC,
        )
        support = User.objects.create(
            email='support@sepatify.test',
            display_name='پشتیبان',
            username='user_support',
            role=User.Role.SUPPORT,
        )
        admin = User.objects.create(
            email='admin@sepatify.test',
            display_name='مدیر سامانه',
            username='user_admin',
            role=User.Role.ADMIN,
        )

        for catalog_user in (listener, gold, artist, support, admin):
            auth_user, _ = AuthUser.objects.update_or_create(
                email=catalog_user.email,
                defaults={
                    'username': catalog_user.username,
                    'display_name': catalog_user.display_name,
                    'role': catalog_user.role,
                    'subscription': catalog_user.subscription,
                    'artist_name': catalog_user.artist_name,
                },
            )
            auth_user.set_password('password')
            auth_user.save(update_fields=['password'])

        album_ocean = Album.objects.create(
            title='اقیانوس بی‌صدا',
            artist=artist,
            cover=cover('al-1'),
            released_at='2026-06-01',
            listeners=12400,
            genre='الکترونیک',
            collaborators=['استودیو شب'],
        )
        album_city = Album.objects.create(
            title='پژواک شهری',
            artist=artist,
            cover=cover('al-2'),
            released_at='2026-06-20',
            listeners=9800,
            genre='امبینت',
        )
        album_dawn = Album.objects.create(
            title='طلوع زرد',
            artist=artist,
            cover=cover('al-3'),
            released_at='2026-07-10',
            listeners=2100,
            early_access=True,
            genre='ایندی',
            collaborators=['نور زرد'],
        )

        tracks = [
            Track.objects.create(
                title='موج اول',
                artist=artist,
                album=album_ocean,
                cover=cover('tr-1'),
                plays=18240,
                listeners=9100,
                released_at='2026-06-01',
                genre='الکترونیک',
                collaborators=['استودیو شب'],
                lyrics='موج اول از دوردست می‌آید\nساحل خاموش را بیدار می‌کند',
                audio_name='moj-aval.flac',
                audio_size=28400000,
                audio_type='audio/flac',
                audio_url=SAMPLE_AUDIO[0],
            ),
            Track.objects.create(
                title='پنجره نور',
                artist=artist,
                album=album_city,
                cover=cover('tr-2'),
                plays=22100,
                listeners=11200,
                released_at='2026-06-20',
                genre='امبینت',
                lyrics='پنجره نور را باز کن\nشهر هنوز خواب است',
                audio_name='panjere-noor.wav',
                audio_size=41200000,
                audio_type='audio/wav',
                audio_url=SAMPLE_AUDIO[1],
            ),
            Track.objects.create(
                title='گام‌های آهسته',
                artist=artist,
                album=album_ocean,
                cover=cover('tr-3'),
                plays=15680,
                listeners=7800,
                released_at='2026-06-01',
                genre='الکترونیک',
                collaborators=['استودیو شب'],
                lyrics='گام‌های آهسته روی سنگفرش خیس',
                audio_name='gamaha.mp3',
                audio_size=8200000,
                audio_type='audio/mpeg',
                audio_url=SAMPLE_AUDIO[2],
            ),
            Track.objects.create(
                title='پیش‌نمایش طلایی',
                artist=artist,
                album=album_dawn,
                cover=cover('tr-4'),
                plays=980,
                listeners=620,
                released_at='2026-07-10',
                early_access=True,
                genre='ایندی',
                collaborators=['نور زرد'],
                lyrics='پیش‌نمایش طلایی پیش از طلوع',
                audio_name='preview-gold.mp3',
                audio_size=6400000,
                audio_type='audio/mpeg',
                audio_url=SAMPLE_AUDIO[3],
            ),
            Track.objects.create(
                title='ریتم سرد',
                artist=artist,
                album=None,
                cover=cover('tr-6'),
                plays=13400,
                listeners=7200,
                released_at='2026-05-15',
                genre='الکترونیک',
                lyrics='ریتم سرد در شب می‌پیچد',
                audio_name='rhythm-cold.mp3',
                audio_size=9100000,
                audio_type='audio/mpeg',
                audio_url=SAMPLE_AUDIO[0],
            ),
        ]

        playlist_rain = Playlist.objects.create(
            title='شب‌های بارانی',
            owner=listener,
            cover=cover('pl-1'),
        )
        playlist_focus = Playlist.objects.create(
            title='تمرکز عمیق',
            owner=gold,
            cover=cover('pl-2'),
        )

        PlaylistTrack.objects.create(playlist=playlist_rain, track=tracks[0], position=0)
        PlaylistTrack.objects.create(playlist=playlist_rain, track=tracks[4], position=1)
        PlaylistTrack.objects.create(playlist=playlist_focus, track=tracks[1], position=0)
        PlaylistTrack.objects.create(playlist=playlist_focus, track=tracks[2], position=1)

        self.stdout.write(self.style.SUCCESS('Seed data loaded.'))
        self.stdout.write(f'artistId={artist.id} listenerId={listener.id} goldId={gold.id}')
