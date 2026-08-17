-- NETSAGE AI SEED DATASET (30 TROUBLESHOOTING CASES + AUDIT LOGS)

INSERT INTO public.cases (case_id, title, symptom, topology_note, show_output, expected_fault, osi_layer, concept, severity, next_command, recommended_fix, version)
VALUES
-- VLAN CASES (4)
(
    'CASE-001',
    'Inter-VLAN Communication Failure via Router-on-a-Stick',
    'PC1 in VLAN 10 (192.168.10.10) cannot ping Server1 in VLAN 20 (192.168.20.50). Gateway 192.168.10.1 responds.',
    'Router R1 connected to Switch S1 via GigabitEthernet0/0/0 trunk line.',
    'R1# show ip interface brief
Gi0/0/0.10  192.168.10.1  YES manual UP  UP
Gi0/0/0.20  unassigned    YES unset  DOWN DOWN
S1# show switchport interface gi0/1
Switchport: Enabled, Administrative Mode: trunk, Operational Mode: trunk',
    'Subinterface for VLAN 20 is down and lacks IP address configuration.',
    'Layer 3',
    'VLAN',
    'High',
    'show ip interface brief',
    'Configure subinterface Gi0/0/0.20 with encapsulation dot1Q 20, assign IP 192.168.20.1 255.255.255.0, and bring interface up.',
    1
),
(
    'CASE-002',
    'Switchport Access VLAN Mismatch',
    'PC2 assigned IP 10.1.1.5/24 is unable to reach local network default gateway 10.1.1.1 or receive broadcast traffic.',
    'PC2 connected to Switch port FastEthernet0/5.',
    'S1# show vlan brief
VLAN Name                             Status    Ports
---- -------------------------------- --------- -------------------------------
1    default                          active    Fa0/1, Fa0/2, Fa0/3, Fa0/4
10   Sales                            active    Fa0/6, Fa0/7
20   Marketing                        active    Fa0/5',
    'Port Fa0/5 is assigned to Marketing (VLAN 20) instead of Sales (VLAN 10).',
    'Layer 2',
    'VLAN',
    'Medium',
    'show vlan brief',
    'Reassign port Fa0/5 to VLAN 10 under interface configuration mode (switchport access vlan 10).',
    1
),
(
    'CASE-003',
    '802.1Q Trunk Native VLAN Mismatch',
    'CDP reports Native VLAN Mismatch between Switch S1 and Switch S2; untagged management traffic is dropped.',
    'S1 GigabitEthernet0/1 connected directly to S2 GigabitEthernet0/1.',
    'S1# show interfaces trunk
Port        Mode         Encapsulation  Status        Native vlan
Gi0/1       on           802.1q         trunking      1
S2# show interfaces trunk
Port        Mode         Encapsulation  Status        Native vlan
Gi0/1       on           802.1q         trunking      99',
    'Native VLAN mismatch between trunk endpoints (VLAN 1 vs VLAN 99).',
    'Layer 2',
    'VLAN',
    'Medium',
    'show interfaces trunk',
    'Align native VLAN on both ends using interface subcommand: switchport trunk native vlan 99 on S1.',
    1
),
(
    'CASE-004',
    'VLAN Missing from Switch Trunk Allowed List',
    'VLAN 30 traffic is not traversing trunk link between Access Switch S1 and Core Switch C1.',
    'Switch S1 connected to Core C1 via Fa0/24.',
    'S1# show interfaces fa0/24 switchport
Administrative Mode: trunk
Operational Mode: trunk
Trunking VLANs Allowed: 10,20',
    'VLAN 30 is pruned/excluded from the allowed VLAN list on trunk port Fa0/24.',
    'Layer 2',
    'VLAN',
    'High',
    'show interfaces fa0/24 switchport',
    'Add VLAN 30 to the allowed list: switchport trunk allowed vlan add 30.',
    1
),

-- GATEWAY CASES (4)
(
    'CASE-005',
    'Host Default Gateway IP Misconfiguration',
    'Workstation HostA can reach local subnet hosts (192.168.1.0/24) but fails to communicate with internet or remote subnets.',
    'HostA network configuration: IP 192.168.1.45, Mask 255.255.255.0, Default Gateway 192.168.1.254. Router interface is 192.168.1.1.',
    'R1# show ip interface brief
GigabitEthernet0/0  192.168.1.1  YES manual UP UP',
    'Default gateway on HostA (192.168.1.254) does not match actual router IP (192.168.1.1).',
    'Layer 3',
    'Gateway',
    'High',
    'show ip interface brief',
    'Change HostA default gateway setting to 192.168.1.1.',
    1
),
(
    'CASE-006',
    'Duplicate IP Address Conflict on Gateway SVI',
    'Intermittent packet loss and ARP table flapping observed when hosts attempt to reach gateway 172.16.10.1.',
    'Switch S1 SVI Interface VLAN 10 and rogue static device.',
    'S1# show log
%SYS-4-CONFIG_I: %IP-4-DUPADDR: Duplicate address 172.16.10.1 on Vlan10, sourced by mac 0002.4a11.88bc',
    'Duplicate IP address 172.16.10.1 assigned on both SVI Vlan10 and a static host device on the network.',
    'Layer 3',
    'Gateway',
    'Critical',
    'show arp',
    'Locate rogue device with MAC 0002.4a11.88bc and change its static IP address.',
    1
),
(
    'CASE-007',
    'Router Subinterface Shutdown State',
    'All hosts on Subnet 10.2.0.0/24 report Gateway Unreachable.',
    'Router R2 subinterface Gi0/0/1.100.',
    'R2# show ip interface brief
Gi0/0/1       unassigned      YES unset  administratively down DOWN
Gi0/0/1.100   10.2.0.1        YES manual administratively down DOWN',
    'Physical parent interface Gi0/0/1 is administratively down.',
    'Layer 1',
    'Gateway',
    'High',
    'show ip interface brief',
    'Issue "no shutdown" command on parent interface GigabitEthernet0/0/1.',
    1
),
(
    'CASE-008',
    'Gateway Subnet Mask Inconsistency',
    'Client IP is 192.168.50.100/24. Client gateway set to 192.168.50.1. Client cannot ping gateway.',
    'Router R1 Gi0/0 gateway interface.',
    'R1# show interface gi0/0
GigabitEthernet0/0 is up, line protocol is up
  Internet address is 192.168.50.1/28',
    'Router gateway interface has incorrect subnet mask /28 (255.255.255.240), causing client IP to fall outside gateway subnet range.',
    'Layer 3',
    'Gateway',
    'High',
    'show interface gi0/0',
    'Reconfigure router interface with correct subnet mask 255.255.255.0 (/24).',
    1
),

-- DHCP CASES (4)
(
    'CASE-009',
    'DHCP IP Address Pool Exhaustion',
    'New clients connecting to Wi-Fi fail to obtain an IP address and receive Automatic Private IP (169.254.x.x).',
    'Router R1 acting as DHCP server for 192.168.30.0/24 subnet.',
    'R1# show ip dhcp binding
Pool LAN_POOL: 254 addresses total, 254 allocated
R1# show ip dhcp pool
Pool LAN_POOL : Total addresses 254, Leased 254, Excluded 0',
    'DHCP address pool LAN_POOL is fully exhausted.',
    'Layer 7',
    'DHCP',
    'High',
    'show ip dhcp pool',
    'Expand subnet scope or lower lease duration, clear idle bindings using "clear ip dhcp binding *".',
    1
),
(
    'CASE-010',
    'Missing IP Helper-Address on Inter-VLAN Router',
    'Clients in VLAN 40 fail to acquire IP address via centralized DHCP server located in VLAN 10.',
    'Router R1 subinterface Gi0/0.40 serving as gateway for VLAN 40.',
    'R1# show running-config interface gi0/0.40
interface GigabitEthernet0/0.40
 encapsulation dot1Q 40
 ip address 192.168.40.1 255.255.255.0',
    'Missing "ip helper-address 192.168.10.254" command on subinterface Gi0/0.40 to relay broadcast DHCPDISCOVER messages to unicast server.',
    'Layer 7',
    'DHCP',
    'High',
    'show running-config interface gi0/0.40',
    'Add "ip helper-address 192.168.10.254" under interface Gi0/0.40 configuration.',
    1
),
(
    'CASE-011',
    'Incorrect Default-Router Option in DHCP Pool',
    'Clients receive IP address via DHCP but cannot reach external networks outside local subnet.',
    'Router R1 running Cisco IOS DHCP server.',
    'R1# show ip dhcp pool POOL_VLAN10
Pool POOL_VLAN10 :
  Network 192.168.10.0 /24
  Default router 192.168.10.250
R1# show ip interface brief
Gi0/0.10 192.168.10.1',
    'DHCP pool default-router option points to invalid IP 192.168.10.250 instead of actual gateway 192.168.10.1.',
    'Layer 7',
    'DHCP',
    'Medium',
    'show ip dhcp pool',
    'Update DHCP pool config: ip dhcp pool POOL_VLAN10 -> default-router 192.168.10.1.',
    1
),
(
    'CASE-012',
    'Cisco IOS DHCP Service Disabled Globally',
    'Router R1 has valid DHCP pool configuration, but no client receives IP addresses.',
    'Router R1.',
    'R1# show running-config | include dhcp
no service dhcp
ip dhcp pool LAN',
    'Cisco IOS DHCP service is disabled globally via "no service dhcp".',
    'Layer 7',
    'DHCP',
    'High',
    'show running-config | include dhcp',
    'Enable DHCP service globally using "service dhcp" in global configuration mode.',
    1
),

-- DNS CASES (3)
(
    'CASE-013',
    'Incorrect Primary DNS Server Configured on Client',
    'Host can ping 8.8.8.8 directly by IP but web browser fails to resolve domain names (e.g. cisco.com).',
    'Host static IP properties.',
    'C:\> ipconfig /all
DNS Servers . . . . . . . . . . . : 192.168.1.200
R1# ping 192.168.1.200
Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 192.168.1.200, timeout is 2 seconds:
..... (0/5 success)',
    'Configured DNS server 192.168.1.200 does not exist or is offline. Active DNS server is 192.168.1.10.',
    'Layer 7',
    'DNS',
    'Medium',
    'ipconfig /all',
    'Update Client DNS server setting to 192.168.1.10.',
    1
),
(
    'CASE-014',
    'Domain Lookup Disabled on Cisco Router',
    'Router R1 fails to resolve hostname "server.lab.local" when executing diagnostic commands.',
    'Router R1 CLI domain resolution.',
    'R1# ping server.lab.local
% Unrecognized command or address name
R1# show running-config | include domain
no ip domain lookup',
    'DNS domain lookup feature disabled on router via "no ip domain lookup".',
    'Layer 7',
    'DNS',
    'Low',
    'show running-config | include domain',
    'Enable domain lookup with "ip domain lookup" and configure "ip name-server 10.1.1.10".',
    1
),
(
    'CASE-015',
    'DNS Traffic Blocked by Access Control List',
    'DNS client requests to 10.10.10.5 timeout; ICMP pings to DNS server succeed.',
    'Router R1 interface ACL.',
    'R1# show ip access-lists
Extended IP access list 101
 10 deny udp any host 10.10.10.5 eq domain
 20 permit ip any any',
    'Extended ACL 101 explicitly denies UDP port 53 (domain) to DNS server 10.10.10.5.',
    'Layer 4',
    'DNS',
    'High',
    'show ip access-lists',
    'Modify ACL 101 to permit UDP and TCP port 53 traffic to DNS server.',
    1
),

-- ROUTING CASES (5)
(
    'CASE-016',
    'Missing Static Route to Remote Subnet',
    'Router R1 cannot reach subnet 172.16.2.0/24 behind Router R2.',
    'R1 connected to R2 via 10.0.0.0/30 serial link.',
    'R1# show ip route
Codes: C - connected, S - static
Gateway of last resort is not set
     10.0.0.0/30 is subnetted, 1 subnets
C       10.0.0.0 is directly connected, Serial0/0/0
C    192.168.1.0/24 is directly connected, GigabitEthernet0/0',
    'Missing static route or dynamic routing protocol entry for destination network 172.16.2.0/24.',
    'Layer 3',
    'Routing',
    'High',
    'show ip route',
    'Add static route on R1: "ip route 172.16.2.0 255.255.255.0 10.0.0.2".',
    1
),
(
    'CASE-017',
    'OSPF Passive-Interface Blocking Adjacency',
    'OSPF neighbor relationship between R1 and R2 fails to form on GigabitEthernet0/0.',
    'R1 and R2 running OSPF area 0.',
    'R1# show ip ospf neighbor
(Empty output)
R1# show running-config | section ospf
router ospf 1
 router-id 1.1.1.1
 passive-interface GigabitEthernet0/0
 network 10.1.1.0 0.0.0.3 area 0',
    'Interface Gi0/0 is configured as passive-interface in OSPF, suppressing hello packets required for adjacency.',
    'Layer 3',
    'Routing',
    'High',
    'show ip ospf neighbor',
    'Remove passive-interface setting: "no passive-interface GigabitEthernet0/0" under "router ospf 1".',
    1
),
(
    'CASE-018',
    'RIP Version 1 vs Version 2 Mismatch',
    'Router R1 sends RIP v2 updates with subnet masks, but R2 running RIP v1 ignores variable length subnet masks (VLSM).',
    'R1 and R2 RIP configuration.',
    'R1# show ip protocols
Routing Protocol is "rip"
  Sending version 2, receive version 2
R2# show ip protocols
Routing Protocol is "rip"
  Sending version 1, receive version 1',
    'RIP version mismatch between R1 (Version 2) and R2 (Version 1).',
    'Layer 3',
    'Routing',
    'Medium',
    'show ip protocols',
    'Configure "version 2" under "router rip" on Router R2.',
    1
),
(
    'CASE-019',
    'Incorrect OSPF Wildcard Mask in Network Command',
    'Router R1 is not advertising network 192.168.10.0/24 into OSPF area 0.',
    'R1 OSPF router process.',
    'R1# show running-config | section ospf
router ospf 10
 network 192.168.10.0 255.255.255.0 area 0',
    'Network statement uses subnet mask format (255.255.255.0) instead of OSPF wildcard mask (0.0.0.255).',
    'Layer 3',
    'Routing',
    'High',
    'show running-config | section ospf',
    'Correct network statement under router ospf 10: "network 192.168.10.0 0.0.0.255 area 0".',
    1
),
(
    'CASE-020',
    'Asymmetric Routing Cause by Unbalanced Metric',
    'Return traffic from Server S1 takes slow backup link while outgoing traffic uses high-speed link.',
    'R1 dual multi-homed routers R1 and R2.',
    'R1# show ip route 0.0.0.0
S*    0.0.0.0/0 [1/0] via 203.0.113.1
R2# show ip route 0.0.0.0
S*    0.0.0.0/0 [1/0] via 198.51.100.1',
    'Asymmetric routing caused by static default routes configured with identical administrative distance over unequal bandwidth paths.',
    'Layer 3',
    'Routing',
    'Medium',
    'show ip route',
    'Adjust administrative distance or floating static route metric on backup link.',
    1
),

-- ACL CASES (4)
(
    'CASE-021',
    'Inbound ACL Blocking ICMP Echo Requests',
    'PC1 cannot ping Web Server 10.0.0.50; HTTP/HTTPS web browsing works normally.',
    'Router R1 interface Gi0/1 inbound ACL.',
    'R1# show ip access-lists SECURE_IN
Extended IP access list SECURE_IN
 10 permit tcp any host 10.0.0.50 eq www
 20 permit tcp any host 10.0.0.50 eq 443
 30 deny icmp any host 10.0.0.50 echo
 40 permit ip any any',
    'ACL SECURE_IN explicitly denies ICMP echo requests to 10.0.0.50.',
    'Layer 3',
    'ACL',
    'Low',
    'show ip access-lists',
    'If ICMP diagnostics are required, remove line 30 or insert "permit icmp any host 10.0.0.50 echo".',
    1
),
(
    'CASE-022',
    'Implicit Deny All Blocking Unlisted Subnet Traffic',
    'Subnet 192.168.20.0/24 hosts cannot access internet through WAN router.',
    'Router R1 WAN interface outbound ACL.',
    'R1# show ip access-lists PERMIT_LAN
Standard IP access list PERMIT_LAN
 10 permit 192.168.10.0, wildcard bits 0.0.0.255
 (Implicit deny any at bottom)',
    'Subnet 192.168.20.0/24 is blocked by the ACL implicit deny rule.',
    'Layer 3',
    'ACL',
    'High',
    'show ip access-lists',
    'Add permit line to ACL: "access-list 1 permit 192.168.20.0 0.0.0.255".',
    1
),
(
    'CASE-023',
    'ACL Applied in Wrong Direction on Interface',
    'Traffic from internal LAN 192.168.1.0/24 to DMZ is blocked even though permit rule exists.',
    'Router R1 interface Gi0/0 ACL application.',
    'R1# show ip interface gi0/0
GigabitEthernet0/0 is up, line protocol is up
  Inbound access list is BLOCK_DMZ
  Outbound access list is unset
R1# show ip access-lists BLOCK_DMZ
Extended IP access list BLOCK_DMZ
 10 deny ip any host 172.16.1.100',
    'ACL BLOCK_DMZ applied inbound on internal LAN interface instead of outbound towards DMZ interface.',
    'Layer 3',
    'ACL',
    'High',
    'show ip interface',
    'Remove inbound ACL application ("no ip access-group BLOCK_DMZ in") and apply outbound on correct interface.',
    1
),
(
    'CASE-024',
    'ACL Standard Number Range Used for Extended Filtering',
    'Admin attempts to block port 80 traffic using standard ACL number 15.',
    'Router R1 ACL configuration.',
    'R1# access-list 15 deny tcp any host 10.1.1.1 eq 80
% Invalid input detected at "^" marker.',
    'ACL number 15 belongs to Standard ACL range (1-99) which does not support protocol or port parameters.',
    'Layer 3',
    'ACL',
    'Medium',
    'show ip access-lists',
    'Use an extended ACL number range (100-199) or named extended ACL: "ip access-list extended BLOCK_WEB".',
    1
),

-- NAT CASES (3)
(
    'CASE-025',
    'Missing Overload Keyword in Port Address Translation (PAT)',
    'Only the first LAN host can access internet; all subsequent hosts fail to connect.',
    'Router R1 NAT configuration.',
    'R1# show running-config | include nat
ip nat inside source list 1 interface GigabitEthernet0/1',
    'NAT statement lacks the "overload" keyword required for multi-host PAT sharing single public IP.',
    'Layer 3',
    'NAT',
    'Critical',
    'show running-config | include nat',
    'Reconfigure NAT statement with overload keyword: "ip nat inside source list 1 interface Gi0/1 overload".',
    1
),
(
    'CASE-026',
    'Inside/Outside NAT Interface Assignment Missing',
    'Router R1 has correct NAT pool and ACL, but no translation occurs in "show ip nat translations".',
    'Router R1 interfaces Gi0/0 (LAN) and Gi0/1 (WAN).',
    'R1# show ip interface gi0/0 | include NAT
  (No output - NAT disabled)
R1# show ip interface gi0/1 | include NAT
  (No output - NAT disabled)',
    'Interfaces Gi0/0 and Gi0/1 lack "ip nat inside" and "ip nat outside" designations.',
    'Layer 3',
    'NAT',
    'High',
    'show ip nat statistics',
    'Apply "ip nat inside" under Gi0/0 and "ip nat outside" under Gi0/1.',
    1
),
(
    'CASE-027',
    'NAT Pool Address Overlap with Local Gateway Subnet',
    'NAT translation creates IP conflict with external gateway router IP 203.0.113.1.',
    'Router R1 public NAT pool configuration.',
    'R1# show ip nat pool PUBLIC_POOL
Pool PUBLIC_POOL: netmask 255.255.255.248
  start 203.0.113.1 end 203.0.113.6',
    'NAT pool start address 203.0.113.1 conflicts with ISP gateway router IP 203.0.113.1.',
    'Layer 3',
    'NAT',
    'High',
    'show ip nat pool',
    'Adjust NAT pool start range to 203.0.113.2.',
    1
),

-- WIRELESS CASES (3)
(
    'CASE-028',
    'WPA2 Pre-Shared Key (PSK) Security Mismatch',
    'Wireless laptops report "Unable to connect to network Lab_WiFi".',
    'Access Point AP1 and Wireless Laptop.',
    'AP1 Security Settings: WPA2-Personal, AES, PSK: "CiscoPass123"
Laptop Settings: WPA2-Personal, AES, PSK: "ciscopass123"',
    'Pre-shared key case sensitivity mismatch between Access Point and Client device.',
    'Layer 2',
    'Wireless',
    'Medium',
    'show wireless summary',
    'Correct pre-shared key on laptop to match AP exact case ("CiscoPass123").',
    1
),
(
    'CASE-029',
    'SSID Broadcast Disabled and Unconfigured Client Profile',
    'Laptops scanning for Wi-Fi networks do not detect "Staff_Net" SSID in available networks list.',
    'Autonomous AP1 configuration.',
    'AP1# show running-config interface dot11Radio 0
interface Dot11Radio0
 encryption mode ciphers aes-ccmp
 ssid Staff_Net
  no guest-mode',
    'SSID broadcasting is disabled ("no guest-mode") on AP, requiring manual SSID profile configuration on clients.',
    'Layer 2',
    'Wireless',
    'Low',
    'show running-config interface dot11Radio 0',
    'Enable SSID broadcast ("guest-mode" under SSID configuration) or manually configure client profile.',
    1
),
(
    'CASE-030',
    'WLC Management Interface VLAN Tagging Mismatch',
    'Lightweight APs fail to discover Wireless LAN Controller (WLC) via CAPWAP.',
    'WLC Management Interface and Switch port Fa0/12.',
    'WLC Interface: Management VLAN 50
Switch Fa0/12: switchport access vlan 10',
    'Switch port Fa0/12 connecting to WLC Management interface is assigned to wrong VLAN 10 instead of VLAN 50.',
    'Layer 2',
    'Wireless',
    'High',
    'show cdp neighbors',
    'Reassign switch port Fa0/12 to switchport access vlan 50 or configure dynamic trunking.',
    1
);

-- SEED RESPONSIBLE AI AUDIT LOG EXAMPLES (5 Initial Examples)
INSERT INTO public.audit_logs (action, entity, entity_id, payload)
VALUES
('FEEDBACK_VERIFICATION', 'human_reviews', 'REV-101', '{
    "case_id": "CASE-001",
    "original_ai_diagnosis": "Missing Route on Router R1",
    "human_correction": "Subinterface Gi0/0/0.20 is administratively down and unassigned",
    "verification_result": "Human correction verified and accurate based on show ip interface brief output.",
    "dataset_updated": false
}'::jsonb),
('FEEDBACK_VERIFICATION', 'human_reviews', 'REV-102', '{
    "case_id": "CASE-005",
    "original_ai_diagnosis": "OSPF Area Mismatch",
    "human_correction": "Host default gateway set to 192.168.1.254 instead of router IP 192.168.1.1",
    "verification_result": "AI diagnosis was inaccurate. Human correction confirmed and verified.",
    "dataset_updated": false
}'::jsonb),
('FEEDBACK_VERIFICATION', 'human_reviews', 'REV-103', '{
    "case_id": "CASE-009",
    "original_ai_diagnosis": "Physical Cable Disconnected",
    "human_correction": "DHCP Pool LAN_POOL addresses fully leased (254/254 allocated)",
    "verification_result": "Human correction confirmed via show ip dhcp pool evidence.",
    "dataset_updated": false
}'::jsonb),
('FEEDBACK_VERIFICATION', 'human_reviews', 'REV-104', '{
    "case_id": "CASE-025",
    "original_ai_diagnosis": "ACL Blocking Traffic",
    "human_correction": "Missing overload keyword in PAT statement",
    "verification_result": "Verified. PAT statement lacks overload keyword preventing multiple hosts from sharing public IP.",
    "dataset_updated": false
}'::jsonb),
('FEEDBACK_VERIFICATION', 'human_reviews', 'REV-105', '{
    "case_id": "CASE-013",
    "original_ai_diagnosis": "Gateway Subnet Mask Inconsistency",
    "human_correction": "Client IP configured with non-existent DNS server 192.168.1.200",
    "verification_result": "Human correction confirmed via ICMP ping failure to 192.168.1.200.",
    "dataset_updated": false
}'::jsonb);
