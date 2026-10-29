# 게임 사운드 라이선스 기록 (세션 6, 2026-10-23)

모두 **CC0 1.0(퍼블릭 도메인)** — 상업·교육 배포 가능, 저작자 표시 의무 없음(감사 표기는 아래에 남김). 각 페이지에서 라이선스 표기를 직접 확인했다.

## 배경음악(OpenGameArt, CC0)
| 게임 파일 | 원곡 | 작가 | 출처 페이지 | 원본 SHA-256(vendor_assets/audio/opengameart_cc0/) |
|---|---|---|---|---|
| bgm/title_happy.ogg | Happy Adventure (Loop), happy_adveture.mp3 46.8 s | TinyWorlds | https://opengameart.org/content/happy-adventure-loop | 50aa6a32625fe8565403a0c8ceb772d7fb500b9267d0019eacfe0fc742b6c73d |
| bgm/town_calm.ogg | Calm Track (loop), calm_track-loop.ogg 249 s | pmiller | https://opengameart.org/content/calm-track | 8c49a37fb9ee5994c919d0e43cf397dd990cb7f2c6c1200b9710a8fe942ad969 |
| bgm/future_sunless.ogg | Sunless, sunless.ogg 57.6 s | Centurion_of_war | https://opengameart.org/content/sunless | 0e10391a5cabf1c5b69a4325e2f7b86fc88687b271b358e6c505f2cdc1ea4a2a |

게임 파일은 ffmpeg로 다시 인코딩만 했다(Vorbis 72–96 kbps, 곡 내용 변경 없음). 원본은 `vendor_assets/audio/opengameart_cc0/`에 보존(Git 제외).

## 효과음(Kenney, CC0 — vendor_assets/audio/kenney_*/License.txt)
| 게임 파일 | 원본 |
|---|---|
| sfx/click.ogg | Interface Sounds / select_001.ogg |
| sfx/open.ogg, sfx/close.ogg | Interface Sounds / open_001.ogg, close_001.ogg |
| sfx/confirm.ogg, sfx/error.ogg, sfx/talk.ogg | Interface Sounds / confirmation_002.ogg, error_004.ogg, pluck_001.ogg |
| sfx/warp.ogg | Sci-Fi Sounds / forceField_001.ogg |
| sfx/record.ogg | RPG Audio / bookFlip1.ogg |
| sfx/jingle_success.ogg, jingle_soft.ogg, jingle_chapter.ogg | Music Jingles / Pizzicato jingles_PIZZI01, PIZZI07, PIZZI10 (success·soft는 더 이상 쓰지 않음) |
| sfx/paper.ogg | RPG Audio / cloth1.ogg (종이배 띄울 때 바스락) |
| sfx/jingle_win.ogg, sfx/jingle_hmm.ogg | Music Jingles / Pizzicato jingles_PIZZI02(올라가는 성공음), PIZZI13(가벼운 '어?') |
