#!/bin/bash

DEPLOYMENTS_FILE=$HOME/.spc/workspaces/active_workspace/.deployments.env

if ! test -f $DEPLOYMENTS_FILE; then
	echo "could not find .deployments.env in active workspace"
	exit 1
fi

echo "found .deployments.env - copying addresses"

content=$(cat $DEPLOYMENTS_FILE)
portal=$(echo ${content##*L1PORTAL_ADDR=} | awk -F ' ' '{print$1}')
bridge=$(echo ${content##*L1STANDARD_BRIDGE_ADDR=} | awk -F ' ' '{print$1}')
rollup=$(echo ${content##*ROLLUP_ADDR=} | awk -F ' ' '{print$1}')

echo VITE_L1_PORTAL_ADDRESS=$portal >> .env
echo VITE_L1_BRIDGE_ADDRESS=$bridge >> .env
echo VITE_ROLLUP_ADDRESS=$rollup >> .env
