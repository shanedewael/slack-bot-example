require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

// Slack SDK
const WebClient = require('@slack/client').WebClient;
// Events API module
const slackEventsAPI = require('@slack/events-api');
// Interactive Messages module
const slackInteractiveMessages = require('@slack/interactive-messages');

// Events API Adapter
const slackEvents = slackEventsAPI.createSlackEventAdapter(process.env.SLACK_VERIFICATION_TOKEN);
// Interactive Messages Adapter
const slackMessages = slackInteractiveMessages.createMessageAdapter(process.env.SLACK_VERIFICATION_TOKEN);

// Server setup
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Server endpoints for Slack
app.use('/slack/events', slackEvents.expressMiddleware());
app.use('/slack/actions', slackMessages.expressMiddleware());
// Slack Web API clients
const bot = new WebClient(process.env.SLACK_BOT_TOKEN);
const web = new WebClient(process.env.SLACK_AUTH_TOKEN);

// Authorized user
let authID;
// User:channel storage
let users = [];
// Server port
const PORT = process.env.PORT || 4391;

// Starts server and tracks authorized user
app.listen(PORT, function() {
	console.log("Bot listening on port " + PORT);
	web.auth.test((err, res) => {
		if (res.ok) {
			authID = res.user_id;
		}
	});
});

slackEvents.on('reaction_added', (event) => {
	bot.chat.postMessage(event.item.channel, ':' + event.reaction + ':');
});

slackEvents.on('member_joined_channel', (event) => {
	// Add user to user array
	if (!users[event.user]) users[event.user] = event.channel;

	// Send DM to event.user
	sendDM(event.user, JSON.stringify(onboardingAttachment))	
});

slackMessages.action('emoji', (payload) => {
  console.log(payload)
	// Original message to modify
	const replacement = payload.original_message;

	if (payload.actions[0].value == 'yes') {
		replacement.text = `Good choice, ${payload.user.name} :relieved:`;
  		delete replacement.attachments;
  		return replacement;
	} else {
		replacement.text = `Yikes :stuck_out_tongue_winking_eye:`;
  		delete replacement.attachments;
  		//check if userID
  		if (users[payload.user.id]) {
        if (authID != payload.user.id) {
          web.channels.kick(users[payload.user.id])
  				.then((info) => { console.log(info) })
  				.catch(console.error);
        } else {
          web.channels.leave(users[payload.user.id])
  				.then((info) => { console.log(info) })
  				.catch(console.error);
        }
  		}
  		return replacement;
	}
});

function sendDM(id, msg) {
	// Open and send intial DM
	bot.im.open(id)
		.then((info) => { bot.chat.postMessage(info.channel.id, "", {attachments: msg})})
		.catch(console.error);
}

const onboardingAttachment = [{
	text: 'Do you like emoji?',
	color: "#ffc211",
	attachment_type: 'default',
	callback_id: 'emoji',
	actions: [
		{
			"name": "yes",
			"text": "Yes :thumbsup:",
			"type": "button",
			"value": "yes"
		},
		{
			"name": "no",
			"text": "No",
			"type": "button",
			"value": "no",
			"style": "danger",
			"confirm": {
				"title": "Are you sure?",
				"text": "Think about it :thinking_face:",
				"ok_text": "Yes",
				"dismiss_text": "No"
			}
		}
	]
}];







