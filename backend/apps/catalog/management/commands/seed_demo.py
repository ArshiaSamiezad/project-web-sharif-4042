import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalog.models import Album, Track
from apps.playlists.models import Playlist, PlaylistTrack
from apps.users.models import User


AuthUser = get_user_model()


SAMPLE_AUDIO = [
    f'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-{i}.mp3'
    for i in range(1, 17)
]

# Metadata uses real titles; audio is royalty-free SoundHelix. Covers from iTunes artwork CDN.
HIP_HOP_CATALOG = [
    {
        'email': 'drake@sepatify.test',
        'username': 'drake',
        'name': 'Drake',
        'albums': [
            {
                'title': 'Take Care',
                'released_at': '2011-11-15',
                'genre': 'Hip Hop',
                'listeners': 4200000,
                'tracks': [
                    ('Headlines', 9100000),
                    ('Marvins Room', 7200000),
                    ('The Motto', 8800000),
                    ('Take Care', 6500000),
                    ('Underground Kings', 4100000),
                ],
            },
            {
                'title': 'Nothing Was the Same',
                'released_at': '2013-09-24',
                'genre': 'Hip Hop',
                'listeners': 3900000,
                'tracks': [
                    ('Started From the Bottom', 9500000),
                    ("Hold On, We're Going Home", 8700000),
                    ('Worst Behavior', 6200000),
                    ('From Time', 5400000),
                    ('Wu-Tang Forever', 3800000),
                ],
            },
            {
                'title': 'Views',
                'released_at': '2016-04-29',
                'genre': 'Hip Hop',
                'listeners': 5100000,
                'tracks': [
                    ('Hotline Bling', 12000000),
                    ('One Dance', 15000000),
                    ('Controlla', 6900000),
                    ('Too Good', 7100000),
                    ('Childs Play', 4300000),
                ],
            },
            {
                'title': 'Scorpion',
                'released_at': '2018-06-29',
                'genre': 'Hip Hop',
                'listeners': 5600000,
                'tracks': [
                    ('Nonstop', 9800000),
                    ("I'm Upset", 7200000),
                    ('Mob Ties', 6100000),
                    ("Can't Take a Joke", 4800000),
                    ('Elevate', 5200000),
                ],
            },
            {
                'title': 'Certified Lover Boy',
                'released_at': '2021-09-03',
                'genre': 'Hip Hop',
                'listeners': 4800000,
                'tracks': [
                    ('Way 2 Sexy', 11000000),
                    ('Fair Trade', 8900000),
                    ('Knife Talk', 7600000),
                    ('Girls Want Girls', 8200000),
                    ('Pipe Down', 4100000),
                ],
            },
            {
                'title': 'Her Loss',
                'released_at': '2022-11-04',
                'genre': 'Hip Hop',
                'listeners': 4100000,
                'collaborators': ['21 Savage'],
                'tracks': [
                    ('On BS', 6400000),
                    ('Major Distribution', 5800000),
                    ('Spin Bout U', 7100000),
                    ('Pussy & Millions', 6900000),
                ],
            },
        ],
        'singles': [
            ("God's Plan", '2018-01-19', 18000000),
            ('Nice For What', '2018-04-06', 11000000),
            ('In My Feelings', '2018-07-10', 14000000),
            ('Toosie Slide', '2020-04-03', 9200000),
        ],
    },
    {
        'email': 'kanye@sepatify.test',
        'username': 'kanyewest',
        'name': 'Kanye West',
        'albums': [
            {
                'title': 'The College Dropout',
                'released_at': '2004-02-10',
                'genre': 'Hip Hop',
                'listeners': 3600000,
                'tracks': [
                    ('Through the Wire', 6200000),
                    ('Jesus Walks', 7800000),
                    ('All Falls Down', 7100000),
                    ('Slow Jamz', 5900000),
                ],
            },
            {
                'title': 'Graduation',
                'released_at': '2007-09-11',
                'genre': 'Hip Hop',
                'listeners': 4800000,
                'tracks': [
                    ('Stronger', 13000000),
                    ('Good Life', 8200000),
                    ('Flashing Lights', 9100000),
                    ("Can't Tell Me Nothing", 7600000),
                    ('Homecoming', 6800000),
                ],
            },
            {
                'title': 'My Beautiful Dark Twisted Fantasy',
                'released_at': '2010-11-22',
                'genre': 'Hip Hop',
                'listeners': 4500000,
                'tracks': [
                    ('POWER', 9700000),
                    ('Runaway', 10500000),
                    ('All of the Lights', 8900000),
                    ('Monster', 7400000),
                ],
            },
            {
                'title': 'Yeezus',
                'released_at': '2013-06-18',
                'genre': 'Hip Hop',
                'listeners': 3300000,
                'tracks': [
                    ('On Sight', 4200000),
                    ('New Slaves', 5100000),
                    ('Blood on the Leaves', 6300000),
                    ('Black Skinhead', 7200000),
                    ('Bound 2', 8100000),
                ],
            },
            {
                'title': 'The Life of Pablo',
                'released_at': '2016-02-14',
                'genre': 'Hip Hop',
                'listeners': 3900000,
                'tracks': [
                    ('Ultralight Beam', 6800000),
                    ('Father Stretch My Hands Pt. 1', 9200000),
                    ('Famous', 8700000),
                    ('Feedback', 4100000),
                    ('Waves', 7400000),
                ],
            },
            {
                'title': 'Donda',
                'released_at': '2021-08-29',
                'genre': 'Hip Hop',
                'listeners': 4200000,
                'tracks': [
                    ('Jail', 6100000),
                    ('Hurricane', 8800000),
                    ('Off the Grid', 7900000),
                    ('Praise God', 7200000),
                    ('Moon', 5400000),
                ],
            },
        ],
        'singles': [
            ('Gold Digger', '2005-07-05', 15000000),
            ('Heartless', '2008-10-28', 9800000),
        ],
    },
    {
        'email': 'future@sepatify.test',
        'username': 'future',
        'name': 'Future',
        'albums': [
            {
                'title': 'DS2',
                'released_at': '2015-07-17',
                'genre': 'Trap',
                'listeners': 3200000,
                'tracks': [
                    ('Fuck Up Some Commas', 6900000),
                    ('Stick Talk', 5400000),
                    ('I Serve the Base', 4100000),
                    ('Where Ya At', 5800000),
                ],
            },
            {
                'title': 'EVOL',
                'released_at': '2016-02-06',
                'genre': 'Trap',
                'listeners': 2900000,
                'tracks': [
                    ('Low Life', 9800000),
                    ('Thought It Was a Drought', 4200000),
                    ("Ain't No Time", 3600000),
                ],
            },
            {
                'title': 'FUTURE',
                'released_at': '2017-02-17',
                'genre': 'Trap',
                'listeners': 3000000,
                'tracks': [
                    ('Mask Off', 16000000),
                    ('Draco', 5200000),
                    ('Used to This', 6100000),
                    ('Rent Money', 3900000),
                ],
            },
            {
                'title': 'High Off Life',
                'released_at': '2020-05-15',
                'genre': 'Trap',
                'listeners': 3100000,
                'tracks': [
                    ('Life Is Good', 12500000),
                    ('Tycoon', 3900000),
                    ('Trillionaire', 4100000),
                ],
            },
            {
                'title': 'I NEVER LIKED YOU',
                'released_at': '2022-04-29',
                'genre': 'Trap',
                'listeners': 3400000,
                'tracks': [
                    ('WAIT FOR U', 14000000),
                    ('LOVE YOU BETTER', 6200000),
                    ('PUFFIN ON ZOOTIEZ', 7100000),
                    ('KEEP IT BURNIN', 4800000),
                ],
            },
        ],
        'singles': [
            ('March Madness', '2015-08-07', 6700000),
            ('Tony Montana', '2011-04-29', 4500000),
        ],
    },
    {
        'email': 'youngthug@sepatify.test',
        'username': 'youngthug',
        'name': 'Young Thug',
        'albums': [
            {
                'title': 'Jeffery',
                'released_at': '2016-08-26',
                'genre': 'Trap',
                'listeners': 2200000,
                'tracks': [
                    ('Wyclef Jean', 6800000),
                    ('Future Swag', 3200000),
                    ('Guwop Home', 2900000),
                ],
            },
            {
                'title': 'Beautiful Thugger Girls',
                'released_at': '2017-06-16',
                'genre': 'Hip Hop',
                'listeners': 2400000,
                'tracks': [
                    ('Relationship', 7400000),
                    ("Family Don't Matter", 4100000),
                    ('Tomorrow Til Infinity', 3600000),
                ],
            },
            {
                'title': 'So Much Fun',
                'released_at': '2019-08-16',
                'genre': 'Trap',
                'listeners': 2800000,
                'tracks': [
                    ('Hot', 9100000),
                    ('The London', 7800000),
                    ('Surf', 4200000),
                    ('Just How It Is', 3500000),
                ],
            },
            {
                'title': 'Punk',
                'released_at': '2021-10-15',
                'genre': 'Hip Hop',
                'listeners': 2100000,
                'tracks': [
                    ('Bubbly', 4800000),
                    ('Ticket to Ride', 3200000),
                    ('Stuffed Fries', 2900000),
                ],
            },
            {
                'title': 'Business Is Business',
                'released_at': '2023-06-23',
                'genre': 'Trap',
                'listeners': 1900000,
                'tracks': [
                    ('Oh U Went', 5100000),
                    ('Delinquent', 2800000),
                    ('Gucci Bathroom', 2400000),
                ],
            },
        ],
        'singles': [
            ('Lifestyle', '2014-06-03', 6200000),
            ('Power', '2017-04-14', 3900000),
        ],
    },
    {
        'email': '21savage@sepatify.test',
        'username': '21savage',
        'name': '21 Savage',
        'albums': [
            {
                'title': 'Issa Album',
                'released_at': '2017-07-07',
                'genre': 'Hip Hop',
                'listeners': 2600000,
                'tracks': [
                    ('Bank Account', 11000000),
                    ('Numb', 4300000),
                    ('Famous', 3900000),
                ],
            },
            {
                'title': 'i am > i was',
                'released_at': '2018-12-21',
                'genre': 'Hip Hop',
                'listeners': 3000000,
                'tracks': [
                    ('a lot', 9800000),
                    ('ball w/o you', 6200000),
                    ('asmd', 3100000),
                ],
            },
            {
                'title': 'Savage Mode II',
                'released_at': '2020-10-02',
                'genre': 'Trap',
                'listeners': 3400000,
                'collaborators': ['Metro Boomin'],
                'tracks': [
                    ('Runnin', 7200000),
                    ('Mr. Right Now', 8100000),
                    ('Many Men', 5600000),
                    ('Glock In My Lap', 6900000),
                ],
            },
            {
                'title': 'american dream',
                'released_at': '2024-01-12',
                'genre': 'Hip Hop',
                'listeners': 3600000,
                'tracks': [
                    ('redrum', 12000000),
                    ('née-nah', 7800000),
                    ('dangerous', 5400000),
                    ('prove it', 6100000),
                ],
            },
        ],
        'singles': [
            ('X', '2016-07-14', 8500000),
            ('Rich Flex', '2022-11-04', 12000000),
        ],
    },
    {
        'email': 'travisscott@sepatify.test',
        'username': 'travisscott',
        'name': 'Travis Scott',
        'albums': [
            {
                'title': 'Rodeo',
                'released_at': '2015-09-04',
                'genre': 'Hip Hop',
                'listeners': 3100000,
                'tracks': [
                    ('Antidote', 9800000),
                    ('90210', 7200000),
                    ('Nightcrawler', 5400000),
                    ('Pick Up the Phone', 8100000),
                ],
            },
            {
                'title': 'Birds in the Trap Sing McKnight',
                'released_at': '2016-09-02',
                'genre': 'Hip Hop',
                'listeners': 3500000,
                'tracks': [
                    ('goosebumps', 14000000),
                    ('pick up the phone', 7600000),
                    ('through the late night', 4800000),
                    ('beibs in the trap', 5200000),
                ],
            },
            {
                'title': 'ASTROWORLD',
                'released_at': '2018-08-03',
                'genre': 'Hip Hop',
                'listeners': 4700000,
                'tracks': [
                    ('SICKO MODE', 17000000),
                    ('STARGAZING', 7800000),
                    ('BUTTERFLY EFFECT', 6900000),
                    ('STOP TRYING TO BE GOD', 4100000),
                ],
            },
            {
                'title': 'UTOPIA',
                'released_at': '2023-07-28',
                'genre': 'Hip Hop',
                'listeners': 3900000,
                'tracks': [
                    ('FE!N', 9800000),
                    ('I KNOW ?', 7200000),
                    ('MY EYES', 6500000),
                    ('MELTDOWN', 8100000),
                ],
            },
        ],
        'singles': [
            ('HIGHEST IN THE ROOM', '2019-10-04', 11000000),
            ('FRANCHISE', '2020-09-25', 7200000),
        ],
    },
    {
        'email': 'kendrick@sepatify.test',
        'username': 'kendricklamar',
        'name': 'Kendrick Lamar',
        'albums': [
            {
                'title': 'good kid, m.A.A.d city',
                'released_at': '2012-10-22',
                'genre': 'Hip Hop',
                'listeners': 4400000,
                'tracks': [
                    ('Swimming Pools (Drank)', 12000000),
                    ('Bitch, Don’t Kill My Vibe', 8900000),
                    ('m.A.A.d city', 7600000),
                    ('Poetic Justice', 8100000),
                ],
            },
            {
                'title': 'To Pimp a Butterfly',
                'released_at': '2015-03-15',
                'genre': 'Hip Hop',
                'listeners': 4100000,
                'tracks': [
                    ('Alright', 9800000),
                    ('King Kunta', 7200000),
                    ('The Blacker the Berry', 5400000),
                    ('i', 6100000),
                ],
            },
            {
                'title': 'DAMN.',
                'released_at': '2017-04-14',
                'genre': 'Hip Hop',
                'listeners': 5200000,
                'tracks': [
                    ('HUMBLE.', 16000000),
                    ('DNA.', 11000000),
                    ('LOYALTY.', 8200000),
                    ('LOVE.', 9100000),
                ],
            },
        ],
        'singles': [
            ('Not Like Us', '2024-05-04', 22000000),
            ('euphoria', '2024-04-30', 15000000),
        ],
    },
    {
        'email': 'jcole@sepatify.test',
        'username': 'jcole',
        'name': 'J. Cole',
        'albums': [
            {
                'title': '2014 Forest Hills Drive',
                'released_at': '2014-12-09',
                'genre': 'Hip Hop',
                'listeners': 4600000,
                'tracks': [
                    ('No Role Modelz', 14000000),
                    ('G.O.M.D.', 7200000),
                    ('Wet Dreamz', 9100000),
                    ('Apparently', 6800000),
                ],
            },
            {
                'title': 'The Off-Season',
                'released_at': '2021-05-14',
                'genre': 'Hip Hop',
                'listeners': 3200000,
                'tracks': [
                    ('m y . l i f e', 7800000),
                    ('a p p l y i n g . p r e s s u r e', 5100000),
                    ('p u n c h i n ‘ . t h e . c l o c k', 4200000),
                ],
            },
        ],
        'singles': [
            ('Middle Child', '2019-01-23', 12000000),
            ('She Knows', '2013-11-26', 6400000),
        ],
    },
    {
        'email': 'lilbaby@sepatify.test',
        'username': 'lilbaby',
        'name': 'Lil Baby',
        'albums': [
            {
                'title': 'My Turn',
                'released_at': '2020-02-28',
                'genre': 'Trap',
                'listeners': 3800000,
                'tracks': [
                    ('Woah', 11000000),
                    ('Sum 2 Prove', 8200000),
                    ('Emotionally Scarred', 6900000),
                    ('Catch the Sun', 4100000),
                ],
            },
            {
                'title': "It's Only Me",
                'released_at': '2022-10-14',
                'genre': 'Trap',
                'listeners': 2900000,
                'tracks': [
                    ('Real As It Gets', 5400000),
                    ('In a Minute', 6100000),
                    ('Heyy', 4800000),
                ],
            },
        ],
        'singles': [
            ('Drip Too Hard', '2018-09-12', 13000000),
            ('The Bigger Picture', '2020-06-12', 7200000),
        ],
    },
    {
        'email': 'gunna@sepatify.test',
        'username': 'gunna',
        'name': 'Gunna',
        'albums': [
            {
                'title': 'WUNNA',
                'released_at': '2020-05-22',
                'genre': 'Trap',
                'listeners': 2700000,
                'tracks': [
                    ('DOLLAZ ON MY HEAD', 7800000),
                    ('WUNNA', 4200000),
                    ('COOLER THAN A BITCH', 5100000),
                ],
            },
            {
                'title': 'DS4EVER',
                'released_at': '2022-01-07',
                'genre': 'Trap',
                'listeners': 2500000,
                'tracks': [
                    ('pushin P', 9800000),
                    ('banking on me', 4600000),
                    ('P power', 5200000),
                ],
            },
        ],
        'singles': [
            ('Sold Out Dates', '2019-02-08', 4100000),
        ],
    },
    {
        'email': 'carti@sepatify.test',
        'username': 'playboicarti',
        'name': 'Playboi Carti',
        'albums': [
            {
                'title': 'Die Lit',
                'released_at': '2018-05-11',
                'genre': 'Hip Hop',
                'listeners': 3000000,
                'tracks': [
                    ('Shoota', 8200000),
                    ('Love Hurts', 5400000),
                    ('R.I.P.', 7100000),
                    ('Long Time (Intro)', 3900000),
                ],
            },
            {
                'title': 'Whole Lotta Red',
                'released_at': '2020-12-25',
                'genre': 'Hip Hop',
                'listeners': 3600000,
                'tracks': [
                    ('Stop Breathing', 7800000),
                    ('Rockstar Made', 6100000),
                    ('Vamp Anthem', 6900000),
                    ('Sky', 9200000),
                ],
            },
        ],
        'singles': [
            ('Magnolia', '2017-04-14', 11000000),
            ('@ MEH', '2020-04-16', 5800000),
        ],
    },
    {
        'email': 'metro@sepatify.test',
        'username': 'metroboomin',
        'name': 'Metro Boomin',
        'albums': [
            {
                'title': 'NOT ALL HEROES WEAR CAPES',
                'released_at': '2018-11-02',
                'genre': 'Hip Hop',
                'listeners': 2800000,
                'tracks': [
                    ('Space Cadet', 7200000),
                    ('No Complaints', 5400000),
                    ("Don't Come Out The House", 4100000),
                ],
            },
            {
                'title': 'HEROES & VILLAINS',
                'released_at': '2022-12-02',
                'genre': 'Hip Hop',
                'listeners': 3700000,
                'tracks': [
                    ('Creepin\'', 14000000),
                    ('Superhero (Heroes & Villains)', 9800000),
                    ('Too Many Nights', 7600000),
                    ('Trance', 6100000),
                ],
            },
        ],
        'singles': [
            ('Like That', '2024-03-22', 16000000),
        ],
    },
    {
        'email': 'uzi@sepatify.test',
        'username': 'liluzivert',
        'name': 'Lil Uzi Vert',
        'albums': [
            {
                'title': 'Luv Is Rage 2',
                'released_at': '2017-08-25',
                'genre': 'Hip Hop',
                'listeners': 3400000,
                'tracks': [
                    ('XO Tour Llif3', 18000000),
                    ('The Way Life Goes', 9200000),
                    ('Sauce It Up', 6800000),
                    ('Dark Queen', 4100000),
                ],
            },
            {
                'title': 'Eternal Atake',
                'released_at': '2020-03-06',
                'genre': 'Hip Hop',
                'listeners': 3100000,
                'tracks': [
                    ('Baby Pluto', 7200000),
                    ('P2', 8100000),
                    ('Futsal Shuffle 2020', 6400000),
                    ('That Way', 5800000),
                ],
            },
        ],
        'singles': [
            ('Just Wanna Rock', '2022-10-17', 13000000),
            ('New Patek', '2018-09-18', 5400000),
        ],
    },
]


def _audio(index):
    url = SAMPLE_AUDIO[index % len(SAMPLE_AUDIO)]
    return {
        'external_audio_url': url,
        'audio_name': f'sample-{(index % len(SAMPLE_AUDIO)) + 1}.mp3',
        'audio_type': 'audio/mpeg',
        'audio_size': 0,
    }


def _norm(text):
    return re.sub(r'[^a-z0-9]+', '', (text or '').lower())


class CoverFetcher:
    def __init__(self, stdout, style):
        self.stdout = stdout
        self.style = style
        self.cache = {}
        self.ok = 0
        self.fail = 0

    def _get_json(self, url):
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'SepatifySeed/1.0', 'Accept': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode('utf-8'))

    def _download(self, url):
        hi_res = (
            url.replace('100x100bb', '600x600bb')
            .replace('60x60bb', '600x600bb')
            .replace('100x100', '600x600')
        )
        req = urllib.request.Request(hi_res, headers={'User-Agent': 'SepatifySeed/1.0'})
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.read(), hi_res

    def search_artwork(self, artist, title, entity='album'):
        key = (entity, _norm(artist), _norm(title))
        if key in self.cache:
            return self.cache[key]

        params = urllib.parse.urlencode(
            {
                'term': f'{artist} {title}',
                'media': 'music',
                'entity': entity,
                'limit': 12,
            }
        )
        url = f'https://itunes.apple.com/search?{params}'
        try:
            payload = self._get_json(url)
            time.sleep(0.15)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            self.stdout.write(self.style.WARNING(f'iTunes search failed: {artist} / {title} ({exc})'))
            self.cache[key] = None
            self.fail += 1
            return None

        results = payload.get('results') or []
        want_album = _norm(title)
        want_artist = _norm(artist)
        best = None
        best_score = -1
        for item in results:
            art = item.get('artworkUrl100') or item.get('artworkUrl60')
            if not art:
                continue
            name = _norm(item.get('collectionName') or item.get('trackName') or '')
            people = _norm(item.get('artistName') or '')
            score = 0
            if want_album and want_album in name:
                score += 5
            if name and name in want_album:
                score += 3
            if want_artist and want_artist in people:
                score += 4
            if score > best_score:
                best_score = score
                best = art
        if best is None and results:
            best = results[0].get('artworkUrl100') or results[0].get('artworkUrl60')
        self.cache[key] = best
        return best

    def attach(self, instance, artist_name, title, entity='album', filename_prefix='cover'):
        art_url = self.search_artwork(artist_name, title, entity=entity)
        if not art_url:
            self.fail += 1
            return False
        try:
            data, _ = self._download(art_url)
            time.sleep(0.05)
        except (urllib.error.URLError, TimeoutError) as exc:
            self.stdout.write(self.style.WARNING(f'cover download failed: {title} ({exc})'))
            self.fail += 1
            return False
        if not data or len(data) < 500:
            self.fail += 1
            return False
        ext = '.jpg'
        if data[:8] == b'\x89PNG\r\n\x1a\n':
            ext = '.png'
        safe = re.sub(r'[^a-zA-Z0-9_-]+', '-', title).strip('-')[:40] or filename_prefix
        instance.cover.save(f'{safe}{ext}', ContentFile(data), save=True)
        self.ok += 1
        return True


def _clear_media_subdir(*parts):
    root = Path(settings.MEDIA_ROOT)
    target = root.joinpath(*parts)
    if not target.exists():
        return
    for path in target.rglob('*'):
        if path.is_file():
            path.unlink(missing_ok=True)


class Command(BaseCommand):
    help = 'Seed demo users plus a large hip-hop / rap catalog with real iTunes covers.'

    def handle(self, *args, **options):
        _clear_media_subdir('covers')
        covers = CoverFetcher(self.stdout, self.style)

        with transaction.atomic():
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
                released_at='2026-06-01',
                listeners=12400,
                genre='الکترونیک',
                collaborators=['استودیو شب'],
            )
            album_city = Album.objects.create(
                title='پژواک شهری',
                artist=artist,
                released_at='2026-06-20',
                listeners=9800,
                genre='امبینت',
            )
            album_dawn = Album.objects.create(
                title='طلوع زرد',
                artist=artist,
                released_at='2026-07-10',
                listeners=2100,
                early_access=True,
                genre='ایندی',
                collaborators=['نور زرد'],
            )

            demo_tracks = [
                Track.objects.create(
                    title='موج اول',
                    artist=artist,
                    album=album_ocean,
                    plays=18240,
                    listeners=9100,
                    released_at='2026-06-01',
                    genre='الکترونیک',
                    collaborators=['استودیو شب'],
                    lyrics='موج اول از دوردست می‌آید',
                    **_audio(0),
                ),
                Track.objects.create(
                    title='پنجره نور',
                    artist=artist,
                    album=album_city,
                    plays=22100,
                    listeners=11200,
                    released_at='2026-06-20',
                    genre='امبینت',
                    lyrics='پنجره نور را باز کن',
                    **_audio(1),
                ),
                Track.objects.create(
                    title='گام‌های آهسته',
                    artist=artist,
                    album=album_ocean,
                    plays=15680,
                    listeners=7800,
                    released_at='2026-06-01',
                    genre='الکترونیک',
                    collaborators=['استودیو شب'],
                    lyrics='گام‌های آهسته روی سنگفرش خیس',
                    **_audio(2),
                ),
                Track.objects.create(
                    title='پیش‌نمایش طلایی',
                    artist=artist,
                    album=album_dawn,
                    plays=980,
                    listeners=620,
                    released_at='2026-07-10',
                    early_access=True,
                    genre='ایندی',
                    collaborators=['نور زرد'],
                    lyrics='پیش‌نمایش طلایی پیش از طلوع',
                    **_audio(3),
                ),
                Track.objects.create(
                    title='ریتم سرد',
                    artist=artist,
                    album=None,
                    plays=13400,
                    listeners=7200,
                    released_at='2026-05-15',
                    genre='الکترونیک',
                    lyrics='ریتم سرد در شب می‌پیچد',
                    **_audio(4),
                ),
            ]

            hip_hop_tracks = []
            audio_i = 5
            for entry in HIP_HOP_CATALOG:
                rapper = User.objects.create(
                    email=entry['email'],
                    display_name=entry['name'],
                    username=entry['username'],
                    role=User.Role.ARTIST,
                    artist_name=entry['name'],
                    status=User.Status.APPROVED,
                    subscription=User.Subscription.GOLD,
                )
                for album_data in entry['albums']:
                    album = Album.objects.create(
                        title=album_data['title'],
                        artist=rapper,
                        released_at=album_data['released_at'],
                        listeners=album_data['listeners'],
                        genre=album_data['genre'],
                        collaborators=album_data.get('collaborators', []),
                    )
                    covers.attach(album, entry['name'], album_data['title'], entity='album')
                    for title, plays in album_data['tracks']:
                        hip_hop_tracks.append(
                            Track.objects.create(
                                title=title,
                                artist=rapper,
                                album=album,
                                plays=plays,
                                listeners=max(plays // 4, 1000),
                                released_at=album_data['released_at'],
                                genre=album_data['genre'],
                                collaborators=album_data.get('collaborators', []),
                                lyrics='',
                                **_audio(audio_i),
                            )
                        )
                        audio_i += 1
                for title, released_at, plays in entry.get('singles', []):
                    track = Track.objects.create(
                        title=title,
                        artist=rapper,
                        album=None,
                        plays=plays,
                        listeners=max(plays // 4, 1000),
                        released_at=released_at,
                        genre='Hip Hop',
                        lyrics='',
                        **_audio(audio_i),
                    )
                    covers.attach(track, entry['name'], title, entity='song', filename_prefix='single')
                    hip_hop_tracks.append(track)
                    audio_i += 1

            playlist_rain = Playlist.objects.create(title='شب‌های بارانی', owner=listener)
            playlist_focus = Playlist.objects.create(title='تمرکز عمیق', owner=gold)
            playlist_rap = Playlist.objects.create(title='Rap Hits', owner=listener)
            playlist_trap = Playlist.objects.create(title='Trap Night', owner=gold)

            PlaylistTrack.objects.create(playlist=playlist_rain, track=demo_tracks[0], position=0)
            PlaylistTrack.objects.create(playlist=playlist_rain, track=demo_tracks[4], position=1)
            PlaylistTrack.objects.create(playlist=playlist_focus, track=demo_tracks[1], position=0)
            PlaylistTrack.objects.create(playlist=playlist_focus, track=demo_tracks[2], position=1)

            for pos, track in enumerate(hip_hop_tracks[:16]):
                PlaylistTrack.objects.create(playlist=playlist_rap, track=track, position=pos)
            for pos, track in enumerate(hip_hop_tracks[16:32]):
                PlaylistTrack.objects.create(playlist=playlist_trap, track=track, position=pos)

            album_count = Album.objects.count()
            track_count = Track.objects.count()
            artist_count = User.objects.filter(role=User.Role.ARTIST).count()
            covered_albums = Album.objects.exclude(cover='').exclude(cover=None).count()
            covered_singles = Track.objects.filter(album__isnull=True).exclude(cover='').exclude(cover=None).count()

        self.stdout.write(self.style.SUCCESS('Seed data loaded.'))
        self.stdout.write(
            f'artists={artist_count} albums={album_count} tracks={track_count} '
            f'(hip-hop tracks={len(hip_hop_tracks)})'
        )
        self.stdout.write(
            f'covers: ok={covers.ok} fail={covers.fail} '
            f'albums_with_cover={covered_albums} singles_with_cover={covered_singles}'
        )
        self.stdout.write(f'artistId={artist.id} listenerId={listener.id} goldId={gold.id}')
