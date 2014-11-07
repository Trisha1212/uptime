#!/bin/sh

while true; do
        returnVal=$(curl -s --connect-timeout 2 -I http://maluuba:RCjvO3vhSP2C8vIfEQ^ats@localhost:8082/dashboard/events | grep HTTP | cut -d ' ' -f 2)
        if [ -z "$returnVal" ] || [ ${returnVal} -ne 200 ]; then
            pidVal=$(ps aux | grep "nodejs"  | grep -v "grep" |  tr -s ' ' | cut -d ' ' -f 2)
            kill -9 ${pidVal}
            echo "Uptime was restarted" | mail -s 'Uptime was restarted' 'pager.duty@maluuba.com'
            nodejs app  &
        else
            echo "Uptime is fine"
        fi
        sleep 300s
done
