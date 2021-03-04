export function fetchPermissions(appName) {
    return navigator.permissions.query(
        { name: appName }
    );
}

export function getSupportedMimeType() {
    const VIDEO_TYPES = [
        "mp4",
        "webm",
        "ogg",
        "x-matroska"
    ];
    const VIDEO_CODECS = [
        "vp9",
        "vp9.0",
        "vp8",
        "vp8.0",
        "avc1",
        "av1",
        "h265",
        "h.265",
        "h264",
        "h.264",
        "opus",
    ];

    let supportedType = '';
    VIDEO_TYPES.forEach((videoType) => {
        const type = `video/${videoType}`;
        VIDEO_CODECS.forEach((codec) => {
            const variations = [
                `${type};codecs=${codec}`,
                `${type};codecs:${codec}`,
                `${type};codecs=${codec.toUpperCase()}`,
                `${type};codecs:${codec.toUpperCase()}`,
                `${type}`
            ]
            variations.forEach(variation => {
                if (MediaRecorder.isTypeSupported(variation)) {
                    supportedType = variation;
                    return;
                }
            })
        });
    });
    return supportedType;
}