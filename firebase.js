const fetch = require('node-fetch');
const defaultCourses = require('./courses.json');

const DB = process.env.FIREBASE_URL;

async function getCourses() {
    try {
        console.log("[Firebase] Fetching courses from database...");
        const response = await fetch(`${DB}/courses.json`);
        const data = await response.json();

        if (!data) {
            console.log("[Firebase] No courses found. Using default courses.");
            return defaultCourses;
        }

        const coursesArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));

        return coursesArray.length > 0 ? coursesArray : defaultCourses;
    } catch (error) {
        console.error("getCourses error:", error.message);
        return defaultCourses;
    }
}

async function getCourseById(index) {
    try {
        console.log(`[Firebase] Fetching course by index: ${index}...`);
        const courses = await getCourses();
        return courses[index - 1] || null;
    } catch (error) {
        console.error("getCourseById error:", error.message);
        return null;
    }
}

async function saveOrder(orderData) {
    try {
        console.log("[Firebase] Saving new order...");
        const response = await fetch(`${DB}/orders.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        const data = await response.json();
        return data.name; 
    } catch (error) {
        console.error("saveOrder error:", error.message);
        return null;
    }
}

async function updateOrder(orderId, updateData) {
    try {
        console.log(`[Firebase] Updating order ID: ${orderId}...`);
        const response = await fetch(`${DB}/orders/${orderId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        return await response.json();
    } catch (error) {
        console.error("updateOrder error:", error.message);
        return null;
    }
}

async function getOrdersByCustomer(customerId) {
    try {
        console.log(`[Firebase] Fetching orders for customer: ${customerId}...`);
        const response = await fetch(`${DB}/orders.json`);
        const data = await response.json();

        if (!data) return [];

        const ordersArray = Object.keys(data)
            .map(key => ({
                id: key,
                orderId: key,
                ...data[key]
            }))
            .filter(order => order.customerId === customerId);

        return ordersArray.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error("getOrdersByCustomer error:", error.message);
        return [];
    }
}

async function getPendingOrders() {
    try {
        console.log("[Firebase] Fetching all pending orders...");
        const response = await fetch(`${DB}/orders.json`);
        const data = await response.json();

        if (!data) return [];

        return Object.keys(data)
            .map(key => ({
                id: key,
                orderId: key,
                ...data[key]
            }))
            .filter(order => order.status === 'AWAITING_VERIFY');
    } catch (error) {
        console.error("getPendingOrders error:", error.message);
        return [];
    }
}

async function getOrderById(orderId) {
    try {
        console.log(`[Firebase] Fetching order details for ID: ${orderId}...`);
        const response = await fetch(`${DB}/orders/${orderId}.json`);
        const data = await response.json();

        if (data) {
            data.id = orderId;
            data.orderId = orderId;
        }
        
        return data || null;
    } catch (error) {
        console.error("getOrderById error:", error.message);
        return null;
    }
}

async function saveCustomer(customerId, customerData) {
    try {
        const cleanId = customerId.replace('@s.whatsapp.net', '');
        console.log(`[Firebase] Saving customer data for: ${cleanId}...`);
        
        const response = await fetch(`${DB}/customers/${cleanId}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customerData)
        });

        return await response.json();
    } catch (error) {
        console.error("saveCustomer error:", error.message);
        return null;
    }
}

module.exports = {
    getCourses,
    getCourseById,
    saveOrder,
    updateOrder,
    getOrdersByCustomer,
    getPendingOrders,
    getOrderById,
    saveCustomer
};
