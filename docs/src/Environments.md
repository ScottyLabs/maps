# Environments

## Production

The production environment is version used by the public users.

**Vercel**: production

- CMU Maps: [maps.scottylabs.org](http://maps.scottylabs.org)
- Visualizer: [floorplans.scottylabs.org](http://floorplans.scottylabs.org)

**Railway**: production

- [api.maps.scottylabs.org](http://api.maps.scottylabs.org)

**Clerk**: production

## Staging

The staging environment is version used by the development team for testing before merging to main.

**Vercel**: staging

- CMU Maps: [maps.slabs-staging.org](http://maps.slabs-staging.org)
- Visualizer: [floorplans.slabs-staging.org](http://floorplans.slabs-staging.org)

**Railway**: staging

- [api.maps.slabs-staging.org](http://api.maps.slabs-staging.org)

**Clerk**: development

## Development

The development environment is used for verifying a PR before merging to staging.

**Vercel**: preview

- CMU Maps: ^https://cmumaps-[0-9a-zA-Z]{9}-scottylabs.vercel.app$
- Visualizer: none since staging is more than enough testing for this internal tool.

**Railway**: development (default connected to the staging branch, but can be changed to a specific branch as needed for api testing)

- [api.maps.slabs-dev.org](http://api.maps.slabs-dev.org)

**Clerk**: development

### Note:

Using Railway PR environment probably could achieve automation of the development environment for every PR, but would be unnecessarily costly since most PRs won't affect the server. Might be worth it to revisit in the future.
