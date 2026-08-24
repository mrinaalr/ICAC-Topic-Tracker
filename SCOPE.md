# Scope

What belongs in this tracker, what does not, and why the line sits where it does.

## The rule

**Every reference must be a publicly reachable URL that anyone can open without credentials.**

If a claim cannot be sourced that way, it does not go in. This is not a formality. The tracker's usefulness rests entirely on a reader being able to check any statement against its source, and a link that only some readers can open breaks that.

## What this is

A map of concepts, open problems, and available work in the Internet Crimes Against Children domain, for engineers, researchers, policy people, and practitioners who want to find a piece of it to work on.

## What this is not

This project does not accept, host, or link to:

- **Tips or reports of suspected abuse.** If you have information about a child in danger, contact law enforcement. In the United States, report to the NCMEC CyberTipline at <https://report.cybertip.org/> or call 911. This repository has no ability to act on a report and no one monitoring it for that purpose.
- **Law enforcement data.** Case management records, CyberTip contents, subscriber records, or anything from a restricted system — regardless of how it was obtained.
- **Victim or offender identification.** No names, images, handles, or identifying details of victims, offenders, or witnesses, including where those details appear in public records. Cite the record, not the person.
- **Abuse material, or anything that helps locate it.** No links, no hashes, no descriptions detailed enough to serve as a pointer. This includes indirect references — search terms, forum names, hosting patterns.
- **Operational tradecraft.** Nothing that reads as instructions for evading detection, whether framed as offense or as red-teaming.
- **Live investigation details.** Ongoing matters, sealed proceedings, or anything under a protective order.
- **Vigilantism.** No coordinating identification, confrontation, or exposure of suspected offenders.

## Grey areas, and how they are handled

**Public court records.** Charging documents and opinions in the public domain may be cited to illustrate a pattern. Cite the document and the pattern, not the individual. Prefer a published copy over a docket link that requires an account.

**Press releases naming a defendant.** Cite the release; do not reproduce the name in topic text. The point of a citation here is the pattern it evidences.

**Platform-specific detail.** Naming a platform in the context of a documented offense pattern is fine — it is in the public record. Detail that functions as a guide to where material is found is not.

**Detection research.** Methods, benchmarks, and failure analysis are in scope. Anything that amounts to an evasion recipe is not, even in a defensive framing.

**Paywalled academic work.** Acceptable if a public abstract or preprint exists — link that. A DOI that resolves to a paywall with a readable abstract is fine.

## How the line is enforced

Partly mechanically, mostly by review.

`tools/validate.py` rejects non-HTTPS URLs, private and loopback addresses, hidden-service addresses, and a short list of known credential-gated hosts. That catches accidents. It cannot catch judgement, so a maintainer reviews every pull request against this document, and anything uncertain is resolved by leaving it out.

The mechanical list is deliberately short. A long denylist would create the impression that passing it means a contribution is in scope, and that is not a signal this project wants to send.

## Reporting a problem

If something on this site is out of scope, open an issue titled `SCOPE:` with the URL and the concern, or email the maintainer. Content will be removed first and discussed after.
