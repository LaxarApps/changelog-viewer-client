# changelog-activity

> Provides a list of repositories with releases and changelogs.


## Content
* [Usage](#usage)
* [References](#references)


## Usage

### Installation

For installation instruction take a look at the [LaxarJS documentation](https://github.com/LaxarJS/laxar/blob/master/docs/manuals/installing_widgets.md).


### Configuration example

```json
{
   "widget": "changelog-activity",
   "features": {
      "server": {
         "url": "http://changelog-server/api"
      },
      "categories": {
         "resource": "categories",
         "include": [ "frontend" ]
      },
      "repository": {
         "action": "getRepository"
      },
      "getAll": {
         "action": "getAll"
      }
   }
}
```
Use this configuration on a page to get a ChangelogActivity instance.

Its mandatory to configure the server url and the feature `categories` with a resource topic and a list with categories which should be included.
With the `repository.action` the activity provides a list of releases with changelogs of a repository after a request.

For full configuration options refer to the [widget.json](widget.json).


## References

The following resources are useful or necessary for the understanding of this document.
The links refer to the latest version of the documentation.
Refer to the [bower.json](./bower.json) for the specific version that is relevant for this document.

* [LaxarJS Concepts]
* [LaxarJS Patterns]

[LaxarJS Concepts]: https://github.com/LaxarJS/laxar/blob/master/docs/concepts.md "LaxarJS Concepts"
[LaxarJS Patterns]: https://github.com/LaxarJS/laxar-patterns/blob/master/docs/index.md "LaxarJS Patterns"
