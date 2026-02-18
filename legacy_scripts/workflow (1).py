from PyPDF2 import PdfWriter, PdfReader
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import date
import os
import csv

# Example of absolute path
# /Users/prrajpal/workflowDoc.pdf
# /Users/prrajpal/Downloads/Maint Bill 3Qtr Yr'2022-23-All.pdf
combined_bill = input("Enter your combined bill pdf file path (absolute path): ")
print(combined_bill)
# combined_bill = "/Users/prrajpal/Downloads/Maint Bill 3Qtr Yr'2022-23-All.pdf"
inputpdf = PdfReader(open(combined_bill, "rb"))

# /Users/prrajpal/contactList2.csv
contacts_file = input("Enter your contacts csv file path (absolute path): ")
print(contacts_file)
# contacts_file = "/Users/prrajpal/contactList2.csv"
contacts = dict()

# opening the CSV file
with open(contacts_file, mode ='r') as file:   
   # reading the CSV file
   csvFile = csv.reader(file)
   # displaying the contents of the CSV file
   for idx,line in enumerate(csvFile):
        if idx <5:
            continue
        # print(line)
        flat_no=line[1].strip()
        email=line[6].strip()
        print(flat_no," - ",email)
        contacts[idx-5]=[flat_no, email]

# Change to society email id
fromaddr = "sundermanek@gmail.com"

# creates SMTP session
s = smtplib.SMTP('smtp.gmail.com', 587)
# start TLS for security
s.starttls()
# Authentication
s.login(fromaddr, "eageudsbhkxwbkbf")

today = str(date.today())
# make folder with today's date
os.mkdir("Maintenance Bill "+today)
cwd = os.getcwd()
os.chdir("%s/Maintenance Bill %s"%(cwd,today))


for i in range(len(inputpdf.pages)):
    # split the combined bill into separate bills inside today's folder
    output = PdfWriter()
    output.add_page(inputpdf.pages[i])
    filename = "Flat no"+contacts[i][0]+" - Lift Repair Bill Dec'25.pdf"
    with open(filename, "wb") as outputStream:
        output.write(outputStream)
    
    # open the file to be sent 
    attachment = open(filename, "rb")

    # TODO: need to change this to read from pdf
    toaddr = contacts[i][1]
    if toaddr == "NO EMAIL":
        continue

    print(filename)
    # Start creating the email to be sent

    # instance of MIMEMultipart
    msg = MIMEMultipart()
    # storing the senders email address  
    msg['From'] = fromaddr
    # storing the receivers email address 
    msg['To'] = toaddr
    # storing the subject of email
    msg['Subject'] = "Flat No-"+contacts[i][0]+" - Lift Repair Bill - Dec Yr 2025-26"
      

    # string to store the body of the email
    body = "Please see attached your society Lift upgrade-Repair fund Bill Dec Yr 2025-26."
    # attach the body with the msg instance
    msg.attach(MIMEText(body, 'plain'))


    # Prepare the attachment of email
    # instance of MIMEBase and named as p
    p = MIMEBase('application', 'octet-stream')
    # To change the payload into encoded form
    p.set_payload((attachment).read())
    # encode into base64
    encoders.encode_base64(p)
    p.add_header('Content-Disposition', "attachment; filename= %s" % filename)
      
    # attach the instance 'p' to instance 'msg'
    msg.attach(p)
      
    # Converts the Multipart msg into a string
    text = msg.as_string()
      
    # sending the mail
    s.sendmail(fromaddr, toaddr, text)

  
# terminating the session
s.quit()