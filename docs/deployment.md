# Deployment

The site is static files: the app and its tiles. The route planner and How far also need a routing server, BRouter with our profiles and routing data. There are two ways to run them:

- **A. One machine** runs both, from the two Docker images, with `docker compose`.
- **B. Separately**: the site on GitHub Pages, and the router on Google Cloud Run or any machine with Docker.

Both are built by the same workflow every night, so either way the data stays fresh. Today the project uses B: the site at yaroshkvorets.github.io/bikeottawa-maps and the router on Cloud Run, while maps.bikeottawa.ca still serves the old site from an EC2 machine.

## What the workflow builds

The `Deploy` workflow (`.github/workflows/deploy.yml`) runs on every push to `main`, on `v*` tags and every night at about 08:20 UTC:

- `site` checks the code, rebuilds the tiles from fresh OSM data, builds the app and pushes the site image;
- `router` builds the router image with fresh routing data, alongside it, and deploys it to Cloud Run once that is set up (B, Deploying from the workflow);
- `deploy` publishes the site to GitHub Pages once `site` has passed.

The images are `ghcr.io/<owner>/bikeottawa-maps` (site) and `ghcr.io/<owner>/bikeottawa-maps-router` (router), where `<owner>` is the repository's owner in lower case. They are tagged `main`, or the version and `latest` for a `v*` tag. A run takes about 5 minutes. If `site` fails, Pages keeps the last good version and nothing else shows it, so check the run after a push: `gh run list`, or the Actions tab.

Repository variables (Settings → Secrets and variables → Actions → Variables) go into the GitHub Pages build:

- `ROUTER_URL`: the router's address, ending in `/brouter`. Without it the planner says no routing server is connected.
- `MAPILLARY_TOKEN`: a Mapillary client token, for street-level photos. Without it cards link to the photos instead.

The site image does not use them: it reaches its router at `/brouter` on its own address, and has no Mapillary token, so its cards link to the photos.

## A. One machine

The site image is nginx serving the app and the tiles, and passing `/brouter` on to the router container. `compose.yml` runs the two together.

You need a Linux machine with Docker and the Compose plugin, a public address, and ports 80 and 443 open. 2 GB of memory is plenty: the router's Java takes up to 512 MB. The two images take about 1 GB of disk, more while a new version is pulled.

1. Get `compose.yml` onto the machine:

   ```sh
   mkdir -p /opt/bikeottawa-maps && cd /opt/bikeottawa-maps
   curl -fsSLO https://raw.githubusercontent.com/<owner>/bikeottawa-maps/main/compose.yml
   ```

   It names the images; if the repository has moved, change their owner to match.

2. Start it:

   ```sh
   docker compose up -d
   curl -s localhost:8080 | head -3   # the app's HTML
   ```

3. Serve it over HTTPS. `compose.yml` serves plain HTTP on port 8080, so put a server in front that gets a certificate. With [Caddy](https://caddyserver.com) on the machine (`apt install caddy` on Debian or Ubuntu), `/etc/caddy/Caddyfile` is:

   ```
   maps.bikeottawa.ca {
     reverse_proxy localhost:8080
   }
   ```

   then `sudo systemctl reload caddy`. Caddy gets and renews the certificate itself once DNS points at the machine.

4. Point DNS at the machine: an A record `maps.bikeottawa.ca` → the machine's public address.

5. Pick up the nightly data. The images are rebuilt each night, but the machine only runs a new one once it pulls it. Add a cron job (`crontab -e`) that runs after the workflow, for example at 09:30 UTC:

   ```
   30 9 * * * cd /opt/bikeottawa-maps && docker compose pull -q && docker compose up -d && docker image prune -f
   ```

   The site is down for a few seconds while the containers restart.

To make the images public, so the machine can pull them without logging in: the owner's Packages page → `bikeottawa-maps` → Package settings → Change visibility → **Public**, and the same for `bikeottawa-maps-router`.

## B. Separately

### The site on GitHub Pages

This is set up already and deploys on its own. In the repository, Settings → Pages → Source must be **GitHub Actions**, and `ROUTER_URL` must point at the router.

To serve it from maps.bikeottawa.ca:

1. Verify the domain, so no other GitHub account can claim it: the owner's Settings → Pages → **Add a domain** → `maps.bikeottawa.ca`. GitHub shows a TXT record; add it in DNS, then click **Verify**.
2. In the repository: Settings → Pages → Custom domain → `maps.bikeottawa.ca` → **Save**. No `CNAME` file is needed. The DNS check fails until step 4; that is expected.
3. Run the workflow: Actions → Deploy → **Run workflow**, or `gh workflow run Deploy`. This build is needed: the site is now served from the root of a domain, not from `/bikeottawa-maps/`, and the workflow takes that path from the Pages settings.
4. In DNS, replace the record for `maps.bikeottawa.ca` with a **CNAME** → `<owner>.github.io`. Check with `dig +short maps.bikeottawa.ca`.
5. Back in Settings → Pages, once the DNS check passes GitHub requests a certificate, usually within minutes, sometimes up to an hour. When it is issued, tick **Enforce HTTPS**.

GitHub Pages limits a site to 1 GB (this one is about 100 MB) and to a soft 100 GB of traffic a month; visitors only download the map tiles they look at.

### The router on Google Cloud Run

Cloud Run runs a container on demand and scales to zero when idle. It cannot pull from ghcr.io directly, so it pulls the router image through Artifact Registry, set up as a mirror of ghcr.io. The router answers requests from any website, so it needs nothing for the site's domain.

1. Install the gcloud CLI and log in. On a Mac with Homebrew:

   ```sh
   brew install --cask gcloud-cli
   gcloud auth login
   ```

   Elsewhere, follow [Install the gcloud CLI](https://cloud.google.com/sdk/docs/install).

2. Create a billing account, if there is none yet: [console.cloud.google.com/billing](https://console.cloud.google.com/billing) → **Create account**, with a payment card. The free tier below still applies. Under that account, **Budgets & alerts** can restrict over-usage and and email you if spending ever passes an amount you set.

3. Create the project and link it to the billing account:

   ```sh
   gcloud projects create bikeottawa-maps --name="Bike Ottawa Maps"
   gcloud config set project bikeottawa-maps
   gcloud billing accounts list   # the ACCOUNT_ID to use below
   gcloud billing projects link bikeottawa-maps --billing-account=ACCOUNT_ID
   ```

   Project ids are unique across Google Cloud; if `bikeottawa-maps` is taken, pick another and use it below.

Then, in the same shell:

```sh
PROJECT=bikeottawa-maps
REGION=northamerica-northeast1   # Montréal
OWNER=bikeottawa                 # the repository's owner, in lower case
```

4. Turn on the services and create the mirror of ghcr.io:

   ```sh
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com
   gcloud artifacts repositories create ghcr --repository-format=docker --location=$REGION \
     --mode=remote-repository --remote-docker-repo=https://ghcr.io
   ```

5. Pick the newest router image by its digest. The mirror can keep serving an older `main`, so the digest makes sure Cloud Run runs this one:

   ```sh
   DIGEST=$(docker buildx imagetools inspect ghcr.io/$OWNER/bikeottawa-maps-router:main | awk '/^Digest:/ {print $2; exit}')
   IMAGE=$REGION-docker.pkg.dev/$PROJECT/ghcr/$OWNER/bikeottawa-maps-router@$DIGEST
   ```

   Without Docker, the digest is on the image's package page on GitHub.

6. Deploy it. The container listens on port 17777 and gives up on a route after 60 seconds; BRouter works on 4 requests at a time.

   ```sh
   gcloud run deploy router --region $REGION --image $IMAGE \
     --port 17777 --memory 1Gi --cpu 1 --concurrency 4 --timeout 60 \
     --cpu-boost --allow-unauthenticated
   ```

   It prints the service's address, `https://router-….run.app`.

7. Check it plans a route:

   ```sh
   curl -s "https://router-….run.app/brouter?lonlats=-75.6972,45.4215|-75.6900,45.4200&profile=ottbike&alternativeidx=0&format=geojson" | head -c 200
   ```

8. Point the site at it and rebuild the site:

   ```sh
   gh variable set ROUTER_URL --body "https://router-….run.app/brouter"
   gh workflow run Deploy
   ```

With no requests the service scales to zero, and the first route after a quiet spell waits up to about 3 seconds while the router starts. `--min-instances 1` keeps one running, at the cost of paying for it while idle.

#### Free tier

Cloud Run's free tier should cover the router at Bike Ottawa's traffic. With the default request-based billing, each month and billing account gets ([pricing](https://cloud.google.com/run/pricing), as of November 2026):

| Free each month            | What it means for the router                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 180,000 vCPU-seconds       | 50 hours of routing on 1 vCPU. A route takes 1 to 2.5 seconds and How far 0.5 to 3, so roughly 60,000 to 100,000 requests. Requests that overlap on one instance count once.                        |
| 360,000 GiB-seconds        | 100 hours at 1 GiB, more than the CPU allows.                                                                                                                                                       |
| 2 million requests         | Far more than the CPU allows.                                                                                                                                                                       |
| 1 GiB out to North America | Likely the first limit. A route is about 10 KB, but How far is about 200 KB at 10 minutes and 1.25 MB at 30: about 5,000 How far at 10 minutes, or 800 at 30. More is billed, around $0.12 per GiB. |

Only time spent on requests counts, so a quiet service costs nothing. `--min-instances 1` is billed all the time, well past the free tier. The mirror keeps every image it has fetched, about 140 MB each, and Artifact Registry stores 0.5 GB free: deploying from the workflow, set it to keep only the newest (below).

#### Deploying from the workflow

The routing data is baked into the image, so the planner gets fresh OSM data, and profile changes, only when a new image is deployed. The `Deploy` workflow does that on every run from `main` once it is set up: it deploys the image it just built as a revision with no traffic, plans a route by bike and on foot on it, and only then sends traffic to it. If either fails, the run fails and the router already running keeps serving. Without the setup it skips this, and steps 5 and 6 deploy by hand.

It signs in to Google Cloud with Workload Identity Federation, so no key is kept in GitHub. Set it up once, from the clone, in the same shell as above, with `SERVICE` the service's name (`router` in step 6):

```sh
SERVICE=router
NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
REPO_ID=$(gh api repos/$OWNER/bikeottawa-maps --jq .id)   # the same after a transfer
RUNTIME=$(gcloud run services describe $SERVICE --region $REGION --format='value(spec.template.spec.serviceAccountName)')
DEPLOYER=router-deployer@$PROJECT.iam.gserviceaccount.com

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com
gcloud iam workload-identity-pools create github --location global --display-name GitHub
gcloud iam workload-identity-pools providers create-oidc bikeottawa-maps --location global \
  --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping google.subject=assertion.sub,attribute.repository_id=assertion.repository_id \
  --attribute-condition "assertion.repository_id == '$REPO_ID' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts create router-deployer --display-name "Deploys the router from GitHub Actions"
gcloud projects add-iam-policy-binding $PROJECT --member serviceAccount:$DEPLOYER --role roles/run.developer --condition None
gcloud iam service-accounts add-iam-policy-binding $RUNTIME --member serviceAccount:$DEPLOYER --role roles/iam.serviceAccountUser
gcloud iam service-accounts add-iam-policy-binding $DEPLOYER --role roles/iam.workloadIdentityUser \
  --member principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/github/attribute.repository_id/$REPO_ID

gh variable set GCP_PROJECT --body $PROJECT
gh variable set GCP_REGION --body $REGION
gh variable set CLOUD_RUN_SERVICE --body $SERVICE
gh variable set GCP_SERVICE_ACCOUNT --body $DEPLOYER
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER \
  --body projects/$NUMBER/locations/global/workloadIdentityPools/github/providers/bikeottawa-maps
```

Only runs from `main` of this repository can sign in, by its id rather than its name, so a transfer to another owner keeps working.

A new image every night fills the mirror by about 140 MB a day. Keep the three newest:

```sh
echo '[{"name": "newest", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 3}},
  {"name": "older", "action": {"type": "Delete"}, "condition": {"olderThan": "3d"}}]' > cleanup.json
gcloud artifacts repositories set-cleanup-policies ghcr --location $REGION --policy cleanup.json --no-dry-run
```

Then run the workflow (`gh workflow run Deploy`) and check its router job deployed.

### Or the router on any machine

Any machine with Docker can run the router alone:

```sh
docker run -d --name router --restart unless-stopped -p 17777:17777 ghcr.io/<owner>/bikeottawa-maps-router:main
```

Put HTTPS in front of it as in A, step 3, with `router.bikeottawa.ca { reverse_proxy localhost:17777 }`. Then set `ROUTER_URL` to `https://router.bikeottawa.ca/brouter` and run the workflow. To pick up the nightly data, pull the image and recreate the container from cron, as in A, step 5.

## Moving to the BikeOttawa organization and maps.bikeottawa.ca

Do the transfer and the domain switch together: the domain and DNS point at the repository's owner, so doing them apart means doing them twice. You need admin on `YaroShkvorets/bikeottawa-maps`, the right to create repositories in BikeOttawa, and access to the `bikeottawa.ca` hosted zone in AWS Route 53.

A day ahead, lower the TTL of the `maps.bikeottawa.ca` record to 300 seconds, so the switch and a rollback take effect quickly. Note its current value, an A record to `3.139.119.96` (the old site on EC2). Pick a quiet time: the site can show a certificate warning for up to an hour.

1. Transfer the repository: Settings → General → Danger Zone → **Transfer ownership**, to `BikeOttawa`. yaroshkvorets.github.io/bikeottawa-maps stops working. Update your clone: `git remote set-url origin git@github.com:BikeOttawa/bikeottawa-maps.git`.
2. Check the settings came across: Pages source **GitHub Actions**, and the variables (`ROUTER_URL`, `MAPILLARY_TOKEN`, and the Cloud Run ones if set). If the organization limits which actions can run (its Settings → Actions → General), allow `actions/*`, `docker/*` and `google-github-actions/*`.
3. Set up the domain as in B, the site on GitHub Pages, with `<owner>` as `bikeottawa`: verify it under the organization's settings, set it on the repository, run the workflow, switch the Route 53 record to a CNAME → `bikeottawa.github.io`, then enforce HTTPS.
4. The new images are `ghcr.io/bikeottawa/...`; make them public. Change the image names in `compose.yml` and `README.md` to match, then commit and push. Leave `routing/Dockerfile` alone: it names the BRouter fork, which stays where it is.
5. Move the router to the new image. The current one is the `bikeottawa-backend` service, in the `bikeottawa-backend` project; it pulls `yaroshkvorets/bikeottawa-maps-router` by digest through a `ghcr` mirror there, set up as in B. See what it runs:

   ```sh
   gcloud run services describe bikeottawa-backend --project bikeottawa-backend --region northamerica-northeast1 \
     --format='value(spec.template.spec.containers[0].image)'
   ```

   With the workflow deploying it (B, Deploying from the workflow), it moves on its own: the workflow signs in by the repository's id, which the transfer keeps, and deploys `bikeottawa/bikeottawa-maps-router`. Until that image is public (step 4) the mirror cannot fetch it, so the router job fails and the old router keeps serving: run the workflow again after step 4, then check the image above.

   By hand, deploy the new image with B, the router on Cloud Run, steps 5 and 6, using `PROJECT=bikeottawa-backend`, `OWNER=bikeottawa` and the service name `bikeottawa-backend` in place of `router`. The address does not change, so `ROUTER_URL` stays. Or set up a new project from step 1 and point `ROUTER_URL` at it.
6. Open https://maps.bikeottawa.ca and check: each layer loads, a route can be planned, How far works, and a place card shows photos.
7. After a few days, once cached DNS has expired, retire the old site's two EC2 machines (AWS us-east-2): maps.bikeottawa.ca's (`3.139.119.96`), which serves the old site and its OSRM routing, and backend.bikeottawa.ca's (`18.220.244.35`), which built the old site's data (Mapbox tilesets and OSRM routing data, see github.com/BikeOttawa/backend.bikeottawa.ca). The `Deploy` workflow does that work now. Check nothing else runs on them first, take snapshots, then stop them. The old site's Mapbox tilesets and token can go too.

Links to the old site's pages keep working after the switch. The build writes a small page at each old path (`/lts/`, `/winter/`, `/pathways/`, `/collisions/`, `/amenities/`, `/routing/`, `/isochrones/`, `/desire/`, `/thefts/`) that sends visitors to the matching map, at the place the old link showed (`web/src/oldSite.ts`).

### Rolling back

While the EC2 machine still runs:

1. In Route 53, put back the A record `maps.bikeottawa.ca` → `3.139.119.96` in place of the CNAME.
2. In the repository, Settings → Pages → remove the custom domain, then run the workflow, so the site works again at `<owner>.github.io/bikeottawa-maps`.
