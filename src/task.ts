/**
 * Task handlers used by the worker.
 *
 * This file provides mock implementations for demo/testing purposes.
 */
export type TaskHandler = (args: Record<string, unknown>) => Promise<void>

// Handler for sending an email.
export async function sendEmail(args: Record<string, unknown>): Promise<void> {
  const { to, subject } = args as { to: string; subject: string }
  console.log(`Sending email to ${to}: ${subject}`)
  await new Promise(resolve => setTimeout(resolve, 2000))
  console.log(`Email sent to ${to}`)
}


// Handler for resizing an image.
export async function resizeImage(args: Record<string, unknown>): Promise<void> {
  const { imagePath, width, height } = args as { imagePath: string; width: number; height: number }
  console.log(`Resizing image at ${imagePath} to ${width}x${height}`);

    // Busy-wait to simulate CPU-bound work (intentional demo behavior).
    const start = Date.now();
    while (Date.now() - start < 3000) {}
    console.log(`Image resizing completed for ${imagePath}`);
    return Promise.resolve();
}

// Handler for generating a report.
export async function generateReport(args: Record<string, unknown>): Promise<void> {
  const { userId, reportType } = args as { userId: string; reportType: string }
  console.log(`Generating ${reportType} report for user ${userId}`);

    // Busy-wait to simulate CPU-bound work (intentional demo behavior).
    const start = Date.now();
    while (Date.now() - start < 4000) {}
    console.log(`Report generation completed for ${reportType}`);
    return Promise.resolve();
}


// Task registry to map task names to their corresponding handler functions.
export const taskRegistry: Record<string, TaskHandler> = {
  send_email:      sendEmail,
  resize_image:    resizeImage,
  generate_report: generateReport,
}



