const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

// Import from other files as per requirements
const { 
    getCourses, 
    saveOrder, 
    updateOrder, 
    getOrdersByCustomer, 
    getPendingOrders, 
    getCourseById 
} = require('./firebase.js');

const { 
    buildMainMenu, 
    buildCourseList, 
    buildCourseDetail, 
    buildPaymentInstructions 
} = require('./menu.js');

// In-memory state management
const userStates = {};

// Initialize OpenAI configured for HuggingFace Mistral
const openai = new OpenAI({
    baseURL: "https://api-inference.huggingface.co/v1/",
    apiKey: process.env.HF_TOKEN
});

async function connectToWhatsApp() {
    // Setup Auth
    const { state, saveCreds } = await useMultiFileAuthState('session_data');

    // Setup Socket
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Connection Events
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Connection closed. You are logged out.');
            }
        } else if (connection === 'open') {
            console.log('✅ STORE BOT IS ONLINE!');
        }
    });

    // Save Credentials Event
    sock.ev.on('creds.update', saveCreds);

    // Message Event
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        
        // Loop Protection
        if (!msg.message || msg.key.fromMe) return;
        const sender = msg.key.remoteJid;
        if (sender === 'status@broadcast') return;

        // Extract Text Content
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     "";
                     
        if (!text.trim()) return;

        const textLower = text.trim().toLowerCase();
        const adminJid = `${process.env.ADMIN_NUMBER}@s.whatsapp.net`;
        const isAdmin = sender === adminJid;

        try {
            // ==========================================
            // 8. ADMIN COMMANDS
            // ==========================================
            if (isAdmin && textLower.startsWith('confirm ')) {
                const orderId = text.trim().split(' ')[1];
                if (!orderId) return;

                await updateOrder(orderId, { status: 'PAID' });
                
                // Fetch all pending to find this order
                const pendingOrders = await getPendingOrders();
                const order = pendingOrders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
                
                if (order) {
                    // Fetch course access link
                    const course = await getCourseById(order.courseId);
                    const accessLink = course?.accessLink || "No link found";

                    // Notify customer
                    await sock.sendMessage(order.customerId, { text: `🎉 পেমেন্ট কনফার্ম! আপনার কোর্স লিঙ্ক:\n${accessLink}` });
                    
                    // Notify admin
                    await sock.sendMessage(adminJid, { text: `✅ Done! Order ${orderId} confirmed.` });
                    console.log(`[Admin] Order ${orderId} confirmed.`);
                } else {
                    await sock.sendMessage(adminJid, { text: `⚠️ Order ${orderId} not found in pending list.` });
                }
                return;
            }

            if (isAdmin && (textLower === 'orders' || textLower === 'অর্ডার')) {
                const pendingOrders = await getPendingOrders();
                if (pendingOrders.length === 0) {
                    await sock.sendMessage(adminJid, { text: "কোনো পেন্ডিং অর্ডার নেই।" });
                    return;
                }
                
                let reply = "🔔 *পেন্ডিং অর্ডার সমূহ:*\n\n";
                pendingOrders.forEach((o, i) => {
                    reply += `${i + 1}. Order ID: ${o.id || o.orderId}\nকাস্টমার: ${o.customerId.split('@')[0]}\nকোর্স: ${o.courseName}\nTrxID: ${o.trxId}\n\n`;
                });
                await sock.sendMessage(adminJid, { text: reply });
                return;
            }

            // ==========================================
            // 6. BUY FLOW
            // ==========================================
            if (textLower.startsWith('buy ')) {
                const courseIndex = parseInt(textLower.split(' ')[1]);
                if (isNaN(courseIndex)) return;

                const courses = await getCourses();
                const course = courses[courseIndex - 1]; // Assuming index starts at 1
                
                if (!course) {
                    await sock.sendMessage(sender, { text: "কোর্সটি পাওয়া যায়নি। সঠিক নম্বর দিন।" });
                    return;
                }

                const orderData = {
                    customerId: sender,
                    courseId: course.id || courseIndex, 
                    courseName: course.name || course.courseName,
                    price: course.price,
                    status: 'AWAITING_PAYMENT',
                    timestamp: Date.now()
                };

                const orderId = await saveOrder(orderData);
                console.log(`[Order] New order ${orderId} generated for ${sender}`);

                const paymentInstructions = `bKash: ${process.env.PAYMENT_BKASH} অথবা Nagad: ${process.env.PAYMENT_NAGAD}\nপরিমাণ: ${course.price} টাকা\nপেমেন্ট করার পর Transaction ID পাঠান।`;
                await sock.sendMessage(sender, { text: paymentInstructions });

                userStates[sender] = { 
                    step: 'AWAITING_TRXID', 
                    orderId: orderId, 
                    courseName: course.name || course.courseName, 
                    price: course.price 
                };
                return;
            }

            // ==========================================
            // 3. USER STATE MANAGEMENT ROUTING
            // ==========================================
            if (userStates[sender]) {
                const state = userStates[sender];
                
                if (state.step === 'AWAITING_COURSE_SELECTION') {
                    const courseIndex = parseInt(textLower);
                    if (!isNaN(courseIndex)) {
                        const courses = await getCourses();
                        const course = courses[courseIndex - 1];
                        
                        if (course) {
                            const details = buildCourseDetail(course);
                            const promptMsg = `\n\nকিনতে চান? নিচে লিখুন: buy ${courseIndex}`;
                            await sock.sendMessage(sender, { text: details + promptMsg });
                            delete userStates[sender]; // Clear state to allow buying
                            return;
                        }
                    }
                } 
                // 7. TRANSACTION ID COLLECTION
                else if (state.step === 'AWAITING_TRXID') {
                    const trxId = text.trim();
                    await updateOrder(state.orderId, { trxId: trxId, status: 'AWAITING_VERIFY' });
                    
                    // Notify Customer
                    await sock.sendMessage(sender, { text: `✅ ধন্যবাদ! আপনার TrxID ${trxId} পেয়েছি। ২৪ ঘণ্টার মধ্যে কনফার্ম করা হবে।` });
                    
                    // Notify Admin
                    const adminMsg = `🔔 নতুন অর্ডার!\nকাস্টমার: ${sender.split('@')[0]}\nকোর্স: ${state.courseName}\nদাম: ${state.price}\nTrxID: ${trxId}\nঅর্ডার আইডি: ${state.orderId}\n\nকনফার্ম করতে লিখুন: confirm ${state.orderId}`;
                    await sock.sendMessage(adminJid, { text: adminMsg });
                    
                    console.log(`[Payment] Received TrxID ${trxId} for order ${state.orderId}`);
                    delete userStates[sender];
                    return;
                }
            }

            // ==========================================
            // 4. MAIN MENU
            // ==========================================
            const menuTriggers = ["hi", "hello", "start", "menu", "হ্যালো", "শুরু"];
            if (menuTriggers.includes(textLower)) {
                const menuText = buildMainMenu();
                await sock.sendMessage(sender, { text: menuText });
                delete userStates[sender];
                return;
            }

            // ==========================================
            // 5. COURSE BROWSING FLOW
            // ==========================================
            if (textLower === '1' || textLower === 'courses' || textLower === 'কোর্স') {
                const courses = await getCourses();
                const courseListStr = buildCourseList(courses);
                await sock.sendMessage(sender, { text: courseListStr });
                
                userStates[sender] = { step: 'AWAITING_COURSE_SELECTION' };
                return;
            }

            // ==========================================
            // 9. MY ORDERS
            // ==========================================
            if (textLower === '2' || textLower === 'my orders' || textLower === 'আমার অর্ডার') {
                const orders = await getOrdersByCustomer(sender);
                if (!orders || orders.length === 0) {
                    await sock.sendMessage(sender, { text: "আপনার কোনো অর্ডার পাওয়া যায়নি।" });
                    return;
                }
                
                let orderReply = "📦 *আপনার অর্ডার সমূহ:*\n\n";
                orders.forEach((o, i) => {
                    const dateStr = new Date(o.timestamp).toLocaleDateString('bn-BD');
                    orderReply += `${i + 1}. ${o.courseName}\nস্ট্যাটাস: ${o.status}\nতারিখ: ${dateStr}\n\n`;
                });
                await sock.sendMessage(sender, { text: orderReply });
                return;
            }

            // ==========================================
            // 10. SUPPORT
            // ==========================================
            if (textLower === '3' || textLower === 'support' || textLower === 'সাপোর্ট') {
                // Forward the literal trigger message to admin as requested, 
                // but usually users attach context, handle both explicit trigger and conversational trigger
                await sock.sendMessage(adminJid, { text: `📩 সাপোর্ট মেসেজ (${sender.split('@')[0]}):\n\n${text}` });
                await sock.sendMessage(sender, { text: "আপনার বার্তা আমাদের টিমে পাঠানো হয়েছে। শীঘ্রই উত্তর দেওয়া হবে।" });
                return;
            }

            // ==========================================
            // 11. FALLBACK (AI)
            // ==========================================
            try {
                const response = await openai.chat.completions.create({
                    model: "mistralai/Mistral-7B-Instruct-v0.3",
                    messages: [
                        { role: "system", content: "You are a helpful WhatsApp bot for a Digital Course Store in Bangladesh. Always reply in clear, short Bengali language. If you don't understand, ask them to type 'menu'." },
                        { role: "user", content: text }
                    ],
                    max_tokens: 150
                });
                
                const aiReply = response.choices[0]?.message?.content?.trim();
                if (aiReply) {
                    await sock.sendMessage(sender, { text: aiReply });
                } else {
                    throw new Error("Empty response from HuggingFace AI.");
                }
            } catch (aiError) {
                console.error("[AI Error]", aiError.message);
                await sock.sendMessage(sender, { text: "বুঝতে পারিনি। মূল মেনুতে ফিরতে 'menu' লিখুন।" });
            }

        } catch (err) {
            console.error("[Error in message processing]", err);
            await sock.sendMessage(sender, { text: "সাময়িক ত্রুটি হয়েছে। মূল মেনুতে ফিরতে 'menu' লিখুন।" });
        }
    });
}

connectToWhatsApp().catch(err => console.error("Critical error in WhatsApp bot:", err));
