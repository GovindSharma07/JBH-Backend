// Helper function to get IST Date
export const getISTDate = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};