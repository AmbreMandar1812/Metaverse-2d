*Mosaic: 2D Metaverse Project*
- Mosaic is 2D Multiplayer virtual-space platform for users to come together and share the same room/space

*Features*
- Developed secure authentication, RESTful APIs, role-based access, space creation, room sharing, and customizable virtual environments.
- Implemented real-time player movement and synchronization, room management, user presence, and WebSocket-based multiplayer communication.
- Designed and integrated relational database models using Prisma ORM and PostgreSQL, including users, spaces, maps, avatars, and placeable elements.
- Created responsive interactive environments with React and HTML Canvas, including keyboard controls, decoration placement, and multiple themed spaces.
- Built and maintained the application as a PNPM monorepo with Turborepo, using separate frontend, HTTP API, WebSocket, and database services.
- Applied Test-Driven Development practices with Jest and Axios, including API tests for authentication, authorization, user metadata, and space operations across the project’s test suite.

*Technology Stack*
- React, TypeScript, Node.js, Express.js, WebSockets, HTML Canvas API, Prisma ORM, PostgreSQL, Zod, JWT, Jest, Axios, pnpm and Turborepo

*Setup the Project*
1. Clone the project
2. In the metaverse folder
   -run `pnpm install`
3. In the metaverse/apps/http folder
   -run `npm install`
4. In the metaverse/apps/ws folder
   -run `npm install`
5. In the metaverse/apps/frontend folder
   -run `npm install`

Your project should be running locally : [here](http://localhost:5173/)

To test the test suites 
1. Move to the test folder
   Run `npm run test`

*Images*
1. Signin/Signup Page
   <img width="1820" height="847" alt="image" src="https://github.com/user-attachments/assets/5a80a2ea-4967-49dc-ab74-d2e5a331ac11" />
3. Landing Page
   <img width="1766" height="852" alt="image" src="https://github.com/user-attachments/assets/0dd42600-380f-44cc-bab1-e5657f567da2" />
4. Space
   <img width="1917" height="867" alt="image" src="https://github.com/user-attachments/assets/07738976-693d-432f-9e79-a10ec7f6e314" />

