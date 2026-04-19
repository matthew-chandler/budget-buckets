Project Name: Budget Buckets
Improving local voter transparency by breaking budgets into bite-sized buckets

User Workflow
User enters city that the user wants to learn more about
If the city the user wants is already in database, use the info from out database
Otherwise, fetch the city’s budget info, read it, and bucket the spending categories into our predefined buckets. Store this information into our database.
Display Pie chart with budget, being able to hover each part and learn what that bucket encompasses
The user can then follow up and learn more using the following capabilities:
Ask further questions about the budget with an agent
Compare their city’s budget with the budget of another city. It should pull the buckets of each city up side by side.
Compare a city’s budget across time, showing a line graph if possible.

Stretch goals
ask for user feedback. Satisfied with these results? If the user is not satisfied, ask WHY. This will allow us to implement refine and protect against systemic biases
ability to display in different languages based on user input
privacy policy to affirm human dignity

Technology
Node
npm/pnpm
React
agent-browser
Pi sdk (https://github.com/badlogic/pi-mono)
Database - sqlite? V2: convex
Frontend: the web app that views everything
API: server/db that the frontend interacts with to get all information it needs. V1: also manages all the scraping


Scraping Workflow:
Run a pi agent with the agent-browser cli (from Vercel)
Pi agent uses agent-browser, spins up a Chrome and does whatever necessary to find the budgets and stuff
Agent returns structured information jsons, pdfs with all the information we want
Store the extracted information in a database
V1: pi, agent-browser should be installed locally if necessary.
Features to Extract (some can be optionally extracted if present)
city name
population
fiscal year
buckets
citation: where did it find the budget?


- Public Safety & Justice
    - Police and fire departments
    - Emergency medical services (EMS)
    - 911 dispatch
    - Court systems
    - Prisons
    - Animal control
- Public Works & Infrastructure
    - Street repair and pothole filling
    - Sanitation (trash and recycling collection)
    - Water and wastewater management
    - Street lighting
- Community & Recreation
    - Parks and recreation centers
    - Public libraries
    - Municipal zoos
    - Arts and cultural affairs
    - Youth development programs
- Health & Human Services
    - Public health initiatives
    - Mental health and addiction services
    - Homeless outreach
    - Affordable housing initiatives
    - Child welfare
- Transportation
    - Public transit infrastructure (buses, light rail)
    - Bike lanes
    - Traffic control
    - Municipal airports or harbors
- Government Operations & Administration
    - Mayor and city council salaries
    - Human resources
    - IT infrastructure
    - Building and safety inspections
    - Finance and tax collection departments
- Pensions & Debt
    - Paying off existing city loans and bonds
    - Funding retirement benefits and pensions for former city workers
- Economic Development
    - Small business grants
    - Workforce training programs
    - Tourism marketing
    - City planning and zoning
- Miscellaneous (Misc.)
    - Emergency reserve funds
    - Legal settlement payouts
    - Highly specific local expenditures that do not fit into the standard buckets
