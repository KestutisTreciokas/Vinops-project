# Security Headers Profile — vinops.online

**Updated:** 2025-09-23 20:20 (Europe/Warsaw)

## Scope
Applied at origin proxy (Caddy) for all public routes: `/`, `/robots.txt`, `/sitemap.xml`, pages and APIs.

## Mandatory headers
| Header                              | Value                                                             |
|-------------------------------------|-------------------------------------------------------------------|
| Strict-Transport-Security           | max-age=31536000; includeSubDomains; preload                      |
| X-Content-Type-Options              | nosniff                                                           |
| Referrer-Policy                     | strict-origin-when-cross-origin                                   |
| X-Frame-Options                     | SAMEORIGIN                                                        |
| Content-Security-Policy-Report-Only | default-src 'self'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'self' |

## Route → headers matrix
| Route          | HSTS | CTO | Referrer | Frame (XFO) | CSP-RO |
|----------------|:----:|:---:|:--------:|:-----------:|:------:|
| `/`            |  ✔   | ✔   |    ✔     |      ✔      |   ✔    |
| `/robots.txt`  |  ✔   | ✔   |    ✔     |      ✔      |   ✔*   |
| `/sitemap.xml` |  ✔   | ✔   |    ✔     |      ✔      |   ✔*   |

\* CSP-RO технически присутствует глобально; не влияет на отдачу текстового/XML контента.

## Notes
- HSTS only over HTTPS (as required).
- `frame-ancestors 'self'` duplicated via XFO SAMEORIGIN for compatibility.
- CSP is in **Report-Only** to avoid blocking. Tighten later with allowlists.


### Implementation notes
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` — через global `header { defer … }`.
- `Strict-Transport-Security`, `Content-Security-Policy-Report-Only` — через `reverse_proxy { header_down +… }` (гарантировано на всех проксируемых ответах).
