exports.getDate= () => {
    const today = new Date();
    const options = {
        timeZone: "Asia/Kolkata",
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }
    return today.toLocaleDateString("en-US",options);
};
exports.getDay= () => {
    const today = new Date();
    const options = {
        timeZone: "Asia/Kolkata",
        weekday: 'long'
    }
    return today.toLocaleDateString("en-US",options);
};