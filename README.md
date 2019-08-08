# automerge-bot

## Introduction
This is the source code for the auto-merge probot. This auto merges a PR when the review is complete and all the status checks are passed.

If branch protection is enabled for a branch, auto-merge merges the PR once branch protection criteria is satisfied.

Setting up probot involves 2 steps:
1. Run the app on a local machine
2. Create the app in Github which will redirect payload to app


## Run the app on local machine to receive the payload:

*Pre-requisites*

```
Nodejs version 10.1

Yarn version 1.6

```

To run the bot, use a linux machine.

1. Clone the Repo

2. Run the following command
    ```
    npm install -g nodemon
    
    npm install log4js
     ```
     
3. Generating the app

   `npx create-probot-app <appname>`
 
 Following will be the questions asked, answer accordingly
```
? App name: auto-merge-app
? Description of app: App for Github
? Author's full name: priyanka-jain
? Author's email address: undefined
? Homepage:
? GitHub user or org name: root
? Repository name: my-first-app
? Which template would you like to use? basic-js
```

4. Run the app:

   `npm run dev`
   
The app will run on the http://localhost:3000

## Setup App in Github
1. First create your app following the path

   **Settings --> Developer Settings --> Github Apps**

On top right corner use button "New Github App" . Enter the following details in:
```
GitHub App name
The name of your GitHub App.


Description (optional)
This is displayed to users of your GitHub App.


Homepage URL
The full URL to your GitHub App’s website.


User authorization callback URL
The full URL to redirect to after a user authorizes an installation.


Setup URL (optional)
A URL to redirect users to after they install your GitHub App if additional setup is required on your end.


 Redirect on update
Redirect users to the Setup URL after installations are updated (E.g. repositories added/removed)


Webhook URL
Events will POST to this URL. Read our webhook documentation for more information. Here put http://<machineIP>:3000. If using ngrok use the ngrok ip


Webhook secret (optional)

```

Once filling above form, give permissions to app based on your app requirements. Then Subscribe to the events you need for app. The app is ready to use. Install on your org. You need to have admin rights in your org to set up the app. 

Then you can decide on which repo you want to install the app on.


More Information about Probot can be found [here](https://probot.github.io/docs/)

More information on Github Events can be found [here](https://developer.github.com/webhooks/#events)

More information on the Github REST API can be found [here](https://developer.github.com/v3/)
