from rest_framework import serializers


class AbsoluteImageField(serializers.ImageField):
    def to_representation(self, value):
        if not value:
            return ''
        try:
            return value.url
        except ValueError:
            return ''


class AbsoluteFileField(serializers.FileField):
    def to_representation(self, value):
        if not value:
            return ''
        try:
            return value.url
        except ValueError:
            return ''
