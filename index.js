require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
  ],
});

let lastNewsContent = null;
const reminders = [];

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerSlashCommands();
  setInterval(checkApiForUpdates, 5000);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "setreminder") {
    const duration = interaction.options.getString("duration");
    const message = interaction.options.getString("message");

    // Parse the duration to calculate the time in milliseconds
    const time = parseDuration(duration);

    // Create a reminder
    const reminder = {
      user: interaction.user.id,
      message: message,
      time: Date.now() + time,
    };

    // Store the reminder
    reminders.push(reminder);

    // Send a confirmation message to the user
    await interaction.reply({
      content: "Reminder set successfully!",
      ephemeral: true, // Only visible to the user who set the reminder
    });
  }
});

async function registerSlashCommands() {
  const guildId = "993863964360458321"; // Replace with your Guild ID
  const commands = [
    new SlashCommandBuilder()
      .setName("setreminder")
      .setDescription("Set a reminder")
      .addStringOption((option) =>
        option
          .setName("duration")
          .setDescription("Duration of the reminder (e.g., 1h, 30m, 2d)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("message")
          .setDescription("Reminder message")
          .setRequired(true)
      ),
  ];

  const guild = await client.guilds.fetch(guildId);
  await guild.commands.set(commands);
}

async function checkApiForUpdates() {
  try {
    // Call the API to retrieve the latest news
    const response = await axios.get(
      "https://news.treeofalpha.com/api/news?limit=1"
    );
    const newsContent = JSON.stringify(response.data);

    // If the news content has changed since the last update, send a message to Discord
    if (newsContent !== lastNewsContent) {
      lastNewsContent = newsContent;

      let newsEmbed;
      if (response.data[0].source === "Twitter") {
        newsEmbed = new EmbedBuilder()
          .setTitle(`Click here to go to Tweet`)
          .setDescription(`This info only correct for present time`)
          .setColor("#fb644c")
          .setTimestamp(Date.now())
          .setURL(response.data[0].url)
          .setImage(
            response.data[0].image
              ? response.data[0].image
              : "https://example.com/default-image.jpg"
          )
          .setFooter({
            text: `${
              response.data[0].source
                ? response.data[0].source
                : "Default source"
            }`,
            iconURL: response.data[0].icon
              ? response.data[0].icon
              : "https://example.com/default-icon.jpg",
          })
          .setURL(response.data[0].url ? response.data[0].url : "")
          .addFields([
            {
              name: `${
                response.data[0].source
                  ? response.data[0].source
                  : "Default source"
              }`,
              value: `${
                response.data[0].title
                  ? response.data[0].title
                  : "Default title"
              }`,
              inline: true,
            },
          ]);
      } else if (response.data[0].source === "Blogs") {
        newsEmbed = new EmbedBuilder()
          .setTitle(`Click here to go to Blog`)
          .setDescription(
            `This info is only correct for present time\n ${response.data[0].title}`
          )
          .setColor("#fb644c")
          .setTimestamp(Date.now())
          .setURL(response.data[0].url)
          .setImage(
            response.data[0].image
              ? response.data[0].image
              : "https://example.com/default-image.jpg"
          )
          .setFooter({
            text: `${
              response.data[0].source
                ? response.data[0].source
                : "Default source"
            }`,
            iconURL: "https://example.com/default-icon.jpg",
          })
          .setURL(response.data[0].url ? response.data[0].url : "");
        if (response.data[0].firstPrice) {
          const firstPriceValues = Object.values(response.data[0].firstPrice);
          newsEmbed.addFields([
            {
              name: `${
                response.data[0].source
                  ? response.data[0].source
                  : "default value 0"
              }`,
              value: `${
                response.data[0].title
                  ? response.data[0].title
                  : "default title 0"
              }`,
              inline: true,
            },
            {
              name: `${
                response.data[0].symbols[0] ? response.data[0].symbols[0] : ""
              }`,
              value: `${firstPriceValues[0] ? firstPriceValues[0] : ""}`,
              inline: false,
            },
            {
              name: `${
                response.data[0].symbols[1] ? response.data[0].symbols[1] : ""
              }`,
              value: `${firstPriceValues[1] ? firstPriceValues[1] : ""}`,
              inline: false,
            },
          ]);
        }
      }

      // Send a message to a Discord channel (replace CHANNEL_ID with the ID of the desired channel)
      const channel = await client.channels.fetch("1113900217583013919");
      await channel.send({ embeds: [newsEmbed] });

      // Log the API response
      console.log(response.data[0].source);
      console.log(response.data[0].title);
      console.log(response.data[0].url);
      console.log(response.data[0].icon);
      console.log(response.data[0].image);
    }

    // Check reminders
    checkReminders();
  } catch (error) {
    console.error(error);
  }
}

function checkReminders() {
  const now = Date.now();

  // Find reminders that are due
  const dueReminders = reminders.filter((reminder) => reminder.time <= now);

  // Remove due reminders from the list
  reminders.splice(
    reminders.findIndex((reminder) => reminder.time <= now),
    dueReminders.length
  );

  // Send reminders to the users
  dueReminders.forEach((reminder) => {
    const user = client.users.cache.get(reminder.user);
    if (user) {
      user.send(`Reminder: ${reminder.message}`);
    }
  });
}

function parseDuration(duration) {
  const matches = duration.match(/^(\d+)([smhd])$/i);
  if (!matches) {
    throw new Error(
      "Invalid duration format. Please use a valid format (e.g., 1h, 30m, 2d)"
    );
  }

  const value = parseInt(matches[1]);
  const unit = matches[2].toLowerCase();

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(
        "Invalid duration format. Please use a valid format (e.g., 1h, 30m, 2d)"
      );
  }
}

client.login(process.env.DISCORD_TOKEN);
