# components-browser-widget

> Lists available components, and allows to display their documentation or changelog

## Features

### 1. Display a list of grouped software components *(components)*

*R1.1* The widget MUSTallow to configure a resource topic under which to expect an artifact listing.

*Note:* The artifacts listing has the following form:

```js
{
   "origins": [
      {
         "name": "origin-one",
         "groups": [
            {
               "name": "group-one",
               "components": [
                  {
                     "name": "component-one",
                     "description": "laxar",
                     "url-repository": "https://github.com/LaxarJS/laxar",
                     "url-readme": "https://raw.githubusercontent.com/LaxarJS/laxar/master/README.md",
                     "url-changelog": "https://raw.githubusercontent.com/LaxarJS/laxar/master/CHANGELOG.md"
                  },
                  {
                     "name": "component-two"
                     // ...
                  }
               ]
            }
         ]
      }
   ]
}
```

Naturally, *origin-one*, *group-one* and so on are placeholders for arbitrary identifiers.

*R1.2* When a listing was received, it must be displayed using one *main block* per origin.

*R1.3* Inside of each main block, three levels of inforation must be displayed as sub-columns, each representing one level of the hierarchy (*origin, group, component*).


### 2. Allow to access related information *(related)*

*R2.1* For each component, a hypertext link must be displayed, labeled according to the component name.

*R2.2* The widget must allow to configure which type of related information to offer when activating a component hyperlink (*readme* or *changelog*).

*R2.3* By default, the widget MUST offer the *readme* information (from the *url-readme* field of each component).

*R2.4* The widget MUST allow to configure a related *resource* and a related *action* to use for publishing related information.

*R2.5* If topics for related *action* and related *resource* are configured, and a component hyperlink is activated via the left mouse button, the widget MUST cancel the regular hyperlink functionality, and instead perform the following steps:
The widget MUST fetch the associated resource using HTTP GET and then publish a `didReplace` event with the resource contents, in a resource format that is compatible with the [laxar-markdown-display-widget](https://github.com/LaxarJS/ax-markdown-display-widget).
After publishing the related resource, the widget MUST publish a `takeActionRequest` for the configured action.
