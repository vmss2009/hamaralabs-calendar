# Slot booking app

- A very minimalistic simple app that is used by my makerspace incharge to schedule time slots for the makerspace

## Features -

- He/She can add time slots, delete, and view them
- Add the no of available time slots for a given time period (my incharge needed it as there could be multiple students who want to attend the same session)
- Replicate schedule of a day to multiple days (very useful feature according to my incharge)
- Toggle button to set the calendar private/public
- Authentik authentication
- Responsive design (works like a charm on mobile)

## Want to run this by yourself ?

- Setup authentik (follow <https://docs.goauthentik.io/install-config/>)
  - Add an application, then a provider, and update the `.env` with those credentials using `env.example` as base
- Install docker engine
- Use the docker compose file (`docker-compose.yml`) and start the container
- According to your set hosting configuration (either nginx serving over the internet or home network or locally in your computer) access your calendar !!!!!
