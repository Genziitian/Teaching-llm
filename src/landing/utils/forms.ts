/**
 * Utility to capture UTM parameters from the URL
 */
export const getUTMParams = () => {
    if (typeof window === 'undefined') return {};

    const params = new URLSearchParams(window.location.search);
    return {
        utm_source: params.get('utm_source') || 'direct',
        utm_medium: params.get('utm_medium') || 'organic',
        utm_campaign: params.get('utm_campaign') || 'none',
    };
};

/**
 * Common function to submit form data to Google Sheets
 * Replace the URL with your Google Apps Script Web App URL
 */
export const submitToGSheet = async (data: any, scriptUrl: string) => {
    const utm = getUTMParams();
    const formData = new URLSearchParams();

    // Merge form data with UTM params
    const fullData = { ...data, ...utm };

    Object.keys(fullData).forEach(key => {
        formData.append(key, fullData[key]);
    });

    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors', // Important for Google Apps Script
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        return true;
    } catch (error) {
        console.error('Error submitting to GSheet:', error);
        return false;
    }
};
