declare interface tUser {
    id: number;
    id_str: string;
    name: string;
    screen_name: string;
    location?: any;
    url?: any;
    description?: any;
    translator_type: string;
    protected: boolean;
    verified: boolean;
    followers_count: number;
    friends_count: number;
    listed_count: number;
    favourites_count: number;
    statuses_count: number;
    created_at: string;
    utc_offset?: any;
    time_zone?: any;
    geo_enabled: boolean;
    lang?: any;
    contributors_enabled: boolean;
    is_translator: boolean;
    profile_background_color: string;
    profile_background_image_url: string;
    profile_background_image_url_https: string;
    profile_background_tile: boolean;
    profile_link_color: string;
    profile_sidebar_border_color: string;
    profile_sidebar_fill_color: string;
    profile_text_color: string;
    profile_use_background_image: boolean;
    profile_image_url: string;
    profile_image_url_https: string;
    default_profile: boolean;
    default_profile_image: boolean;
    following?: any;
    follow_request_sent?: any;
    notifications?: any;
}

declare interface tHashtag {
    text: string;
    indices: number[];
}

declare interface tThumb {
    w: number;
    h: number;
    resize: string;
}

declare interface tMedium {
    w: number;
    h: number;
    resize: string;
}

declare interface tSmall {
    w: number;
    h: number;
    resize: string;
}

declare interface tLarge {
    w: number;
    h: number;
    resize: string;
}

declare interface tSizes {
    thumb: tThumb;
    medium: tMedium;
    small: tSmall;
    large: tLarge;
}

declare interface tMedia {
    id: number;
    id_str: string;
    indices: number[];
    media_url: string;
    media_url_https: string;
    url: string;
    display_url: string;
    expanded_url: string;
    type: string;
    sizes: tSizes;
}

declare interface tEntities {
    hashtags: tHashtag[];
    urls: any[];
    user_mentions: any[];
    symbols: any[];
    media: tMedia[];
}

declare interface tExtendedMedia {
    id: number;
    id_str: string;
    indices: number[];
    media_url: string;
    media_url_https: string;
    url: string;
    display_url: string;
    expanded_url: string;
    type: "video" | "photo";
    sizes: tSizes;
    video_info: undefined | tVideoInfo;
}

declare interface tVideoInfo {
    aspect_ratio: number[];
    duration_millis: number;
    variants: tVideoVariant[];
}

declare interface tVideoVariant {
    bitrate: undefined | number;
    content_type: string;
    url: string;
}

declare interface tExtendedEntities {
    media: tExtendedMedia[];
}

declare interface tTweet {
    created_at: string;
    id: number;
    id_str: string;
    text: string;
    display_text_range: number[];
    source: string;
    truncated: boolean;
    in_reply_to_status_id?: any;
    in_reply_to_status_id_str?: any;
    in_reply_to_user_id?: any;
    in_reply_to_user_id_str?: any;
    in_reply_to_screen_name?: any;
    user: tUser;
    geo?: any;
    coordinates?: any;
    place?: any;
    contributors?: any;
    is_quote_status: boolean;
    quote_count: number;
    reply_count: number;
    retweet_count: number;
    favorite_count: number;
    entities: tEntities;
    extended_entities: tExtendedEntities;
    favorited: boolean;
    retweeted: boolean;
    possibly_sensitive: boolean;
    filter_level: string;
    lang: string;
    timestamp_ms: string;
}

