// var CryptoJS = require("crypto-js");

var sender_id = userId;
var receiver_id;
var socket = io('/user-namespace', {
    auth: {
        token: userId,
    },
});

socket.on('connect', () => {
    console.log('Connected with socket ID:', socket.id);

    $(document).ready(function () {

        $('.user-list').click(function () {

            var userId = $(this).attr('data-id');
            // var usersocketid = $(this).attr('data-socketid');
            // console.log(usersocketid);
            receiver_id = userId;

            //sending server the userId of the user who has been clicked from the user list by the sender.
            socket.emit('invited', receiver_id);

            $('.start-head').hide();
            $('.chat-section').show();

            socket.emit('existsChat', { sender_id: sender_id, receiver_id: receiver_id });
        });
    });

    //get user online status
    socket.on('getOnlineUser', function (data) {
        // $('#' + data.user_id + '-status').text('Online');
        $('#' + data.user_id + '-status').removeClass('offline-status');
        $('#' + data.user_id + '-status').addClass('online-status');
    });
    //get user offline status
    socket.on('getOfflineUser', function (data) {
        // $('#' + data.user_id + '-status').text('Offline');
        $('#' + data.user_id + '-status').addClass('offline-status');
        $('#' + data.user_id + '-status').removeClass('online-status');
    });

    // ---------------------------------------------------------------
    //Diffie Hellman Key Exchange.

    let publicKey = {
        p: 0,
        g: 0
    };

    // Generate b
    const secretKey = Math.floor(Math.random() * 9) + 1;
    // Receive p & q from server
    socket.on("request", data => {
        publicKey = data;
        console.log("Secret Key: ", secretKey);
        console.log("p: ", publicKey.p, "g: ", publicKey.g);

        // Calculate B = q^b mod p
        let senderPk = Math.pow(publicKey.g, secretKey) % publicKey.p;
        console.log("sender pk", senderPk);

        // Send B to server and get K_a, A from server
        socket.emit("Sender PBK", senderPk);

        //invitation to join room from server send by sender
        socket.on("new_invitation", data => {

            const socketIdA = data.inviteBy;
            const senderPbkReceived = data.pk;

            console.log("Receiver PBK :", senderPbkReceived);

            // Calculate K(a) = B^a mod p
            const sharedSecret = Math.pow(senderPbkReceived, secretKey) % publicKey.p;
            console.log("Shared Secret Key: " + sharedSecret);

            console.log(`Invitation from sender: ${socketIdA}`);

            socket.emit("invitation_accept", {
                invitedBy: socketIdA,
                acceptedBy: socket.id,
                pk: senderPk
            });
        });

        // socket.on("receiverpk", data => {
        //     console.log("receiver pk :", data);
        //     const B = data;

        //     // Calculate K(a) = B^a mod p
        //     const sharedSecret = Math.pow(B, secretKey) % publicKey.p;
        //     console.log("Shared Secret: " + sharedSecret);
        // });
    });
    // ---------------------------------------------------------------

    //chat save of user
    $('#chat-form').submit(function (event) {
        event.preventDefault();

        var message = $('#message').val();

        let encryptedMessage = CryptoJS.AES.encrypt(message, sharedSecret.toString()).toString();
        console.log(encryptedMessage)

        $.ajax({
            url: '/save-chat',
            type: 'POST',
            data: { sender_id: sender_id, receiver_id: receiver_id, message: encryptedMessage },
            success: function (response) {
                if (response.success) {
                    // console.log(response.data.message);
                    $('#message').val('');
                    let decryptedMessage = CryptoJS.AES.decrypt(response.data.message, sharedSecret.toString()).toString(CryptoJS.enc.Utf8);
                    let chat = decryptedMessage;
                    let html = `
                        <div class="current-user-chat">
                            <h5>`+ chat + `</h5>
                        </div>
                        `;
                    $('#chat-container').append(html);
                    socket.emit('newChat', response.data)
                } else {
                    alert(response.msg);
                }
            }
        });
    });

    socket.on('loadNewChat', function (data) {

        if (sender_id == data.receiver_id && receiver_id == data.sender_id) {
            let decryptedMessage = CryptoJS.AES.decrypt(data.message, sharedSecret.toString()).toString(CryptoJS.enc.Utf8);
            let html = `
                <div class="distance-user-chat">
                    <h5>`+ decryptedMessage + `</h5>
                </div>
                `;
            $('#chat-container').append(html);
        }

    });

    //load old chats
    socket.on('loadChats', function (data) {
        $('#chat-container').html('');

        var chats = data.chats;
        // console.log(chats);

        let html = '';

        for (let x = 0; x < chats.length; x++) {

            let addClass = '';
            if (chats[x]['sender_id'] == sender_id) {
                addClass = 'current-user-chat';
            } else {
                addClass = 'distance-user-chat';
            }

            let decryptedMessage = CryptoJS.AES.decrypt(chats[x]['message'], sharedSecret.toString()).toString(CryptoJS.enc.Utf8);

            html += `
                <div class="`+ addClass + `">
                    <h5>`+ decryptedMessage + `</h5>
                </div>
                `;
        }
        $('#chat-container').append(html);
    });
});