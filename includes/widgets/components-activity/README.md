# components-activity

> Provides a grouped list of software components, with references to their documentation and changelogs

## Features

### 1. Fetch a list of software components (*components*)

*R1.1* The activity MUST allow to configure a URL from which to fetch an artifact listing in JSON format.

*R1.2* The activity MUST allow to configure a resource topic under which to publish the artifact listing upon receipt.

*R1.3* When instantiated, the activity MUST try to fetch the configured artifacts listing using HTTP GET.

*R1.4* If an artifact listing was received, the activity MUST publish it under the configured resource using a `didReplace` event.
 
*R1.5* If the artifact listing could not be received (e.g. due to an HTTP 4xx or 5xx response), or failed to parse as JSON, the activity MUST publish a `didEncounterError` event.
