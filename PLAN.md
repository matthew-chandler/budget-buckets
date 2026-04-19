
User Workflow
    enter city that the user wants to learn more about
    if city already in database, use pre-bucketed info
        otherwise, fetch the city’s budget info, read it, and bucket the spending categories
    display Pi chart with budget, being able to hover each part and learn what that bucket encompasses
    the user can then choose the following options:
        ask further questions with an agent about the budget
        compare their city’s budget with the budget of a city (maybe even suggest other cities)
        compare across years in history

Technology
    Node
    npm/pnpm
    React
    agent-browser
    Pi sdk 
    Database - sqlite?
