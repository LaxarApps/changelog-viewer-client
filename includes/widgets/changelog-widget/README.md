# changelog-widget

> Display a list of repositories with changelogs.


## Content
* [Usage](#usage)
* [References](#references)


## Usage

### Installation

For installation instruction take a look at the [LaxarJS documentation](https://github.com/LaxarJS/laxar/blob/master/docs/manuals/installing_widgets.md).


### Configuration example

```json
{
   "widget": "changelog-widget",
   "features": {
      "categories": {
         "resource": "categories"
      },
      "repository": {
         "action": "getRepository"
      }
   }
}
```
Use this configuration on a page to get a ChangelogWidget instance.

The widget expects a configured `categories.resource` and a configured `repository.action`.
The resource must include a list with categories, groups and repositories.
With the `repository.action` the widget requests the releases with changelog of a specific repository.

For full configuration options refer to the [widget.json](widget.json).


## References

The following resources are useful or necessary for the understanding of this document.
The links refer to the latest version of the documentation.
Refer to the [bower.json](./bower.json) for the specific version that is relevant for this document.

* [LaxarJS Concepts]
* [LaxarJS Patterns]

[LaxarJS Concepts]: https://github.com/LaxarJS/laxar/blob/master/docs/concepts.md "LaxarJS Concepts"
[LaxarJS Patterns]: https://github.com/LaxarJS/laxar-patterns/blob/master/docs/index.md "LaxarJS Patterns"
