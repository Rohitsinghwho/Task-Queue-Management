

// handler for sending a email
function sendEmail({subject ,to}){
    console.log(`Email sent to ${to} with subject: ${subject}`);

    // simulate email sending delay
    const start=Date.now();
    while(Date.now()-start<2000){} //simulate 2s delay
    console.log(`Email sending completed for ${to}`);
}


// handler for resizing an image
function resizeImage({imagePath,width,height}){
    console.log(`Resizing image at ${imagePath} to ${width}x${height}`);

    // simulate image resizing delay
    const start=Date.now();
    while(Date.now()-start<3000){} //simulate 3s delay
    console.log(`Image resizing completed for ${imagePath}`);
}

// handler for generating a report
function generateReport({userId, reportType}){
    console.log(`Generating ${reportType} report for user ${userId}`);

    // simulate report generation delay
    const start=Date.now();
    while(Date.now()-start<4000){} //simulate 4s delay
    console.log(`Report generation completed for ${reportType}`);
}


// task registry to map task names to their corresponding handler functions
export const taskRegistry={
    "send_email": sendEmail,
    "resize_image": resizeImage,
    "generate_report": generateReport
};




