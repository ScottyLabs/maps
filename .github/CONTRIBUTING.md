# How to Contribute to CMU Maps

## Did you find a bug, have an idea for a new feature, or any questions?

See [ScottyLabs Base Contributing Guide](https://github.com/ScottyLabs/wiki/wiki/Base-Contributing-Guide).

## Do you want to contribute to the design?

We use [Figma](https://www.figma.com/design/4hihRwPsE7JDWI21q72B03/CMU-Maps) for design.
If you are interested in contributing to the CMU Maps design, you can send a message
pining the design lead (Wunwan Boonsitanara) in the [CMU Maps Slack channel](https://github.com/ScottyLabs/cmumaps/wiki/Communication).

## Do you want to contribute to the codebase?

### Prerequisites

Because working on CMU Maps requires access to Carnegie Mellon University's campus data,
you need to have an [Andrew ID](https://www.cmu.edu/computing/services/security/identity-access/account/userid.html).

### First Steps

Follow the instructions in [ScottyLabs Base Contributing Guide](https://github.com/ScottyLabs/wiki/wiki/Base-Contributing-Guide#do-you-want-to-contribute-to-the-codebase) to get started.

The [Project Board](https://github.com/orgs/ScottyLabs/projects/11/views/1)
is another useful resource to find a issue you might be interested in. Please
avoid picking issues in Backlog since they need to be groomed first. Please also
don't pick an issue typed `Maintenance` or `Task` as your first issue.

When opening your Governance PR, make sure to
use the [CODEOWNERS file](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) to ping the appropriate reviewers
when opening your PR.

### Setup and Develop

Follow the [running guide](../docs/src/Setup.md) for native Nix/devenv setup on
macOS, Linux, or Windows through WSL2. Ask the team for Maps development
OpenBao access and an authorized dataset. A successful OpenBao login alone does
not grant access to every secret path.

### Key Resources

- [Setup and manual run](../docs/src/Setup.md)
- [Style Guide](../docs/src/Style-Guide.md)
- [Troubleshooting](../docs/src/Troubleshooting.md)

### Additional Notes

For CI checks, your goal is to pass all checks starting with "Check /" with a ✅. They are also run in precommit hooks.

Make sure to not include any sensitive informations in your PR. No detailed floorplan
except CUC can be shown. Use a Google Drive link with the "Anyone in CMU with the link can view"
access permission as needed.

## Join Us! 🎉

We encourage you to get involved and join [the team](https://github.com/ScottyLabs/governance/blob/main/teams/cmumaps.toml)!

Thanks! ❤️

CMU Maps Team
