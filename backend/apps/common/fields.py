from rest_framework import serializers


class AbsoluteImageField(serializers.ImageField):
    def to_representation(self, value):
        if not value:
            return ''
        request = self.context.get('request')
        url = value.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class AbsoluteFileField(serializers.FileField):
    def to_representation(self, value):
        if not value:
            return ''
        request = self.context.get('request')
        url = value.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url
