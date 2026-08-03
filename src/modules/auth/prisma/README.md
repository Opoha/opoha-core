# Auth module — Prisma ownership

Canonical models for this module live in the composed Prisma folder:

`database/prisma/auth.prisma`

**Owner:** `auth` module  
**Rule:** Plugins may reference `User.id` / permission keys by value; they must not edit this schema file.
