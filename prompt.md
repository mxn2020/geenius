we have two folders:\│
│ - geenius\ │
│ - geeniues-template-vite...\ │
│ \│
│ geenius is the system that has a cli (and will soon have a simple vite frontend) as tool for deploying templates like the given template from the second folder but via│
│ github.\ │
│ \│
│ it tracks it status.\│
│ it also has an agentic ai setup.\│
│ the templates contain a dev-container package. the user can submit change requests from the template directly to this geenius system.\ │
│ \│
│ geenius will then clone the repo of the template, deploy an agentic ai in a stackblitz webcontainer where the templates repo was cloned into, then applied the change│
│ requetss as a fully autonomous ai agent, then creates tests for each change, runs tests and improves code until everything is fine, then commits and pushes the changes│
│ (all of this on a feature/xyz branch taken from the develop branch). this will then initiate an automatic deploy of the feature branch in netlifdy where the user can│
│ test and accept the changes. then the ai agent merges the changes into devlop. user can again test and accept. then it merges it into main.\ │
│ \│
│ this is the process.\│ currently i can cerate change requests and submit them.
geenius receives them but is struggling with the webcontainer setup.

as webcontainers are not available for servers i would like to create 3 choices:

- complete serverside agentic ai workflow to update the template and push it back to github
- use vercels process like described in the video.md file
- open a browser tab and use stackblitz webcontainers to run the agentic ai in the browser

can you implement these 3 options in the geenius system?
- use 3 new api routes for each option (process-changes can be reviewed for context but should not be changed)
- all netlify functions in geenius app are in its /api folder
- the template should not be changed.

provide a comprehensive modular implementation, where the options do not interfere with each other.

after you are done i will update the template to provide options of the current process changes route and the 3 new routes

do not use any mockup or placholder code or implementations. we need a working implementation.

provide a full comprehensive implementation for further automatic processing