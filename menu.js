const numberEmojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function getNumberEmoji(num) {
    return numberEmojis[num] || `${num}.`;
}

function buildMainMenu() {
    return `🛍️ *স্বাগতম! ডিজিটাল কোর্স স্টোর*
━━━━━━━━━━━━━━━
আপনি কী করতে চান?

1️⃣  কোর্স দেখুন
2️⃣  আমার অর্ডার
3️⃣  সাপোর্ট

নম্বর টাইপ করুন 👆`;
}

function buildCourseList(coursesArray) {
    if (!coursesArray || coursesArray.length === 0) {
        return `দুঃখিত, বর্তমানে কোনো কোর্স উপলব্ধ নেই।`;
    }

    let text = `📚 *আমাদের কোর্সসমূহ*\n━━━━━━━━━━━━━━━\n\n`;
    
    coursesArray.forEach((course, index) => {
        const num = index + 1;
        const emoji = getNumberEmoji(num);
        const name = course?.name || 'অজানা কোর্স';
        const price = course?.price || 0;
        const duration = course?.duration || 'অজানা';
        
        text += `${emoji} *${name}*\n   💰 মূল্য: ${price} টাকা\n   ⏱️ সময়কাল: ${duration}\n\n`;
    });
    
    text += `বিস্তারিত দেখতে নম্বর টাইপ করুন 👆`;
    return text;
}

function buildCourseDetail(course, courseNumber) {
    if (!course) {
        return `দুঃখিত, কোর্সটি পাওয়া যায়নি।`;
    }

    const name = course.name || 'অজানা কোর্স';
    const description = course.description || 'কোনো বিবরণ নেই';
    const price = course.price || 0;
    const duration = course.duration || 'অজানা';
    const num = courseNumber || 1;

    return `📖 *${name}*
━━━━━━━━━━━━━━━

📝 বিবরণ: ${description}
💰 মূল্য: ${price} টাকা
⏱️ সময়কাল: ${duration}

কোর্সটি কিনতে লিখুন:
👉 buy ${num}`;
}

function buildPaymentInstructions(course, bkash, nagad) {
    if (!course) {
        return `ত্রুটি: কোর্সের তথ্য পাওয়া যায়নি।`;
    }

    const name = course.name || 'অজানা কোর্স';
    const price = course.price || 0;
    const bkashNumber = bkash || 'নম্বর উপলব্ধ নেই';
    const nagadNumber = nagad || 'নম্বর উপলব্ধ নেই';

    return `💳 *পেমেন্ট করুন*
━━━━━━━━━━━━━━━

কোর্স: ${name}
মূল্য: *${price} টাকা*

পেমেন্ট করুন (যেকোনো একটি):

📱 *bKash (Send Money):*
${bkashNumber}

📱 *Nagad (Send Money):*
${nagadNumber}

✅ পেমেন্ট করার পর Transaction ID টি এখানে পাঠান।`;
}

function buildOrderList(ordersArray) {
    if (!ordersArray || ordersArray.length === 0) {
        return `🧾 *আপনার অর্ডারসমূহ*\n━━━━━━━━━━━━━━━\n\nআপনার কোনো অর্ডার পাওয়া যায়নি।`;
    }

    const statusMap = {
        'AWAITING_PAYMENT': '⏳ পেমেন্টের অপেক্ষায়',
        'AWAITING_VERIFY': '🔍 যাচাই করা হচ্ছে',
        'PAID': '✅ কনফার্মড'
    };

    let text = `🧾 *আপনার অর্ডারসমূহ*\n━━━━━━━━━━━━━━━\n\n`;

    ordersArray.forEach(order => {
        const courseName = order?.courseName || 'অজানা কোর্স';
        const status = statusMap[order?.status] || order?.status || 'অজানা';
        const date = order?.timestamp 
            ? new Date(order.timestamp).toLocaleDateString('bn-BD') 
            : 'অজানা';

        text += `📦 *${courseName}*\nস্ট্যাটাস: ${status}\nতারিখ: ${date}\n─────────────\n`;
    });

    return text.trim();
}

function buildAdminNotification(sender, courseName, price, trxId, orderId) {
    return `🔔 *নতুন পেমেন্ট রিকোয়েস্ট!*
━━━━━━━━━━━━━━━
👤 কাস্টমার: ${sender || 'অজানা'}
📚 কোর্স: ${courseName || 'অজানা'}
💰 মূল্য: ${price || 0} টাকা
🔑 TrxID: ${trxId || 'নেই'}
🆔 অর্ডার ID: ${orderId || 'নেই'}

✅ কনফার্ম করতে লিখুন:
confirm ${orderId || ''}`;
}

function buildAccessDelivery(courseName, accessLink) {
    const name = courseName || 'অজানা কোর্স';
    const link = accessLink || 'শীঘ্রই দেওয়া হবে';

    return `🎉 *পেমেন্ট কনফার্ম হয়েছে!*
━━━━━━━━━━━━━━━
অভিনন্দন! আপনার কোর্স অ্যাক্সেস পেতে নিচের লিঙ্কে যান:

📚 কোর্স: ${name}
🔗 লিঙ্ক: ${link}

যেকোনো সমস্যায় 'support' লিখুন।`;
}

module.exports = {
    buildMainMenu,
    buildCourseList,
    buildCourseDetail,
    buildPaymentInstructions,
    buildOrderList,
    buildAdminNotification,
    buildAccessDelivery
};
