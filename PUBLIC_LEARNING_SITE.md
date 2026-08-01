# FaragallahTech Public Learning Site

This branch adds the public, Arabic FaragallahTech learning website while keeping the existing Frappe Learning application under `/lms`.

## Public routes

- `/` — landing page
- `/courses/<slug>` — public course details
- `/subscribe/<slug>` — authenticated paid subscription request
- `/enroll/<slug>` — free-course enrollment flow
- `/signup` — preserves the approved route and opens Frappe's existing signup form
- `/lms` — existing Frappe Learning application

## Editable Frappe records

- **Landing Page Settings** — logo, hero, copy, instructor, gallery, partners, FAQ, footer and default button labels
- **Course Offering Category** — tabs, order, default tab and empty-state copy
- **Course Offering** — public course card, details, price, action, category and linked LMS content
- **Course Subscription Request** — payment proof submitted for manual review

The starter migration creates only:

1. `كورسات`
2. `أولى بكالوريا`
3. `تانية بكالوريا`
4. One `Code++` offering under `كورسات`

No placeholder courses are created.

## Required checks before deployment

Run inside a disposable test site or a local copy first:

```bash
bench --site <test-site> migrate
bench --site <test-site> run-tests --app lms --module lms.test_public_website
```

Then verify:

- `/` renders all three tabs
- `كورسات` is active by default
- the two empty tabs show their editable empty state
- Code++ is the only course card
- `/courses/code-plus-plus` renders
- `/subscribe/code-plus-plus` redirects guests to login and loads for an authenticated user
- Python and JavaScript both run in the public lab
- `/lms` remains the existing Frappe Learning interface

## Importing the supplied media

Extract the supplied media archive into one directory while preserving the original file names, then run:

```bash
bench --site <site> execute lms.setup_public_site.import_public_site_media \
  --kwargs '{"asset_directory":"/absolute/path/to/extracted-media"}'
```

The importer uploads the images as normal Frappe `File` documents and assigns them to editable fields. The templates do not hardcode image paths.

Expected original file names:

- `FaragallahTech logo(3).png`
- `My Image.png`
- `About me.jpg`
- `Offline_Sessions (3).jpg`
- `Offline_Sessions (2).jpg`
- `image(9).png`
- `image(10).png`
- `iskytech.png`
- `ai school.png`
- `ischool.png`
- `image(8).png`
- `Ad design with sky blue shirt.png`

## Production deployment without a Vite build

The public website is server-rendered Jinja plus static CSS/JavaScript. It does not require rebuilding the Vue frontend.

After checking out the branch in the live app repository:

1. Run the site migration.
2. Copy `apps/lms/lms/public/landing` into `sites/assets/lms/landing` using a temporary directory and atomic rename.
3. Import the supplied media.
4. Clear the site cache.
5. Restart only the Frappe application container/service.
6. Verify the HTML and each landing CSS/JS asset returns HTTP 200.

Do not run `bench build --app lms` on the current low-memory production server.

## Rollback

Before deployment, back up:

- the database
- `sites/assets/lms/landing`, if it already exists
- the current app commit

A source rollback must also account for the migrated DocTypes. The new records are isolated and do not alter existing LMS Course, Batch, Enrollment or lesson data.
