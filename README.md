# ChangelogViewerClient

The ChangelogViewerClient lets you display a list with repositories with releases and changelogs.
The client requires a server like the [ChangelogViewerServer](https://github.com/LaxarApps/changelog-viewer-server) which provides the data about the repositories in [JSON HAL](https://tools.ietf.org/html/draft-kelly-json-hal-07).


## Usage

Configure the url of the server in the `overview.json`.

In the `Gruntfile.js` change the host and ports of the proxies configuration.

The viewer supports the [iframe-resizer](https://github.com/davidjbradshaw/iframe-resizer).
If you embed it to a site with an iframe and includes the iframe-resizer the iframe will resize its height to display the whole content.

```
<script src="iframeResizer.min.js"></script>

<style>iframe{width:100%}</style>
<iframe scrolling="no" src="http://changelog-viewer-client"></iframe>
<script>iFrameResize({log:true})</script>
```


### Expected Relations

*component-map*: a list with origins (=categories) each with a list with groups with components (=repositories)

*categories*: a list of categories

*category*: a single category with all available *repositories*

*repositories*: a list of repositories

*repository*: a single repository with all available *releases*

*releases*: a list of releases

*release*: a single release


