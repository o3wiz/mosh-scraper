# Mosh Scraper Guide

> You have to purchase the course you are trying to scrape!
> 
> Only the videos will get downloaded

## Instructions

### Steps

1. Set the following environment variables in `.env` file:
    - MEMBER_URL - should always be: https://members.codewithmosh.com
    - COOKIES_PATH - path to mosh course cookies (json format)
        - use [this](https://chromewebstore.google.com/detail/export-cookie-json-file-f/nmckokihipjgplolmcmjakknndddifde?pli=1) chrome extension to get this
    - COURSE - course path
        - For example: https://members.codewithmosh.com/courses/double-your-coding-speed-1/lectures/4200146
          * COURSE should be "courses/double-your-coding-speed-1/lectures/4200146"
        - Basically the first video of the course
    - ARIA2C_OUTPUT - where should aria2c links should be saved.
        > **_NOTE:_** ARIA2 is the tool we are using to download mosh course's content eventually.
2. After the aria2 file was created make sure the output looks good, (course, section and chapter names to your liking)
3. Install [this](https://chromewebstore.google.com/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg) extension and export your mosh cookies in Netscape format
![Exporting Netscape cookies example](https://i.imgur.com/PfZGuvS.png)
4. Download the courses by running this command:
```shell
$ aria2c -i <aria2c_links_path> --load-cookies <netscape_cookies>
```

# 🍿️
