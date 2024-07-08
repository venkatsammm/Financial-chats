import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import moment from 'moment';
import { db } from '../../firebase/Firebase';
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import '../App.css';

const ChatApp = () => {
  const [name, setName] = useState('');
  const [messages, setMessages] = useState([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [socket, setSocket] = useState(null);
  const messageEndRef = useRef(null);
  const [messageInput, setMessageInput] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editMessageId, setEditMessageId] = useState(null);
  const messageTone = new Audio('/message-tone.mp3');
  const feedbackTimeout = useRef(null);

  const randomNames = [
    'Alice', 'Bob', 'Charlie', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Isabella', 'Jack', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Rose', 'Sam', 'Tina', 'Uma', 'Victor', 'Wendy', 'Xavier', 'Yara', 'Zane'
  ];

  useEffect(() => {
    const savedName = localStorage.getItem('chatAppName');
    if (savedName) {
      setName(savedName);
    } else {
      const randomIndex = Math.floor(Math.random() * randomNames.length);
      const randomName = randomNames[randomIndex];
      setName(randomName);
      localStorage.setItem('chatAppName', randomName);
    }

    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    const messagesCollection = collection(db, 'messages');
    const q = query(messagesCollection, orderBy('dateTime'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        data.id = doc.id;
        data.dateTime = data.dateTime.toDate();
        return data;
      });
      setMessages(messages);
      scrollToBottom();
    });

    newSocket.on('initial-messages', (initialMessages) => {
      setMessages(initialMessages);
    });

    newSocket.on('chat-message', (data) => {
      data.dateTime = new Date(data.dateTime);
      receiveMessage(data);
    });

    newSocket.on('clients-total', (data) => {
      setClientsTotal(data.total);
    });

    newSocket.on('feedback', (data) => {
      setFeedback(data.feedback);
    });

    newSocket.on('typing', (data) => {
      if (data.name !== name) {
        setFeedback(`${data.name} is typing...`);
        clearTimeout(feedbackTimeout.current);
        feedbackTimeout.current = setTimeout(() => {
          setFeedback('');
        }, 2000);
      }
    });

    return () => {
      newSocket.close();
      unsubscribe();
    };
  }, [name]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (messageInput === '') return;

    if (editMode) {
      const data = {
        name: name,
        message: messageInput,
        dateTime: new Date(),
      };
      await updateDoc(doc(db, 'messages', editMessageId), data);
      setEditMode(false);
      setEditMessageId(null);
    } else {
      const data = {
        name: name,
        message: messageInput,
        dateTime: new Date(),
      };
      socket.emit('message', data);
      addMessageToUI(true, data);
      saveMessageToFirestore(data);
    }
    setMessageInput('');
  };

  const receiveMessage = (data) => {
    addMessageToUI(data.name === name, data);
    messageTone.play();
    scrollToBottom();
  };

  const addMessageToUI = (isOwnMessage, data) => {
    const newMessages = [...messages, { ...data, isOwnMessage }];
    setMessages(newMessages);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearFeedback = () => {
    setFeedback('');
  };

  const saveMessageToFirestore = async (data) => {
    try {
      await addDoc(collection(db, 'messages'), {
        ...data,
        dateTime: Timestamp.fromDate(data.dateTime),
      });
    } catch (error) {
      console.error("Error saving message to Firestore: ", error);
    }
  };

  const deleteMessage = async (id) => {
    try {
      await deleteDoc(doc(db, 'messages', id));
    } catch (error) {
      console.error("Error deleting message from Firestore: ", error);
    }
  };

  const editMessage = (message) => {
    setMessageInput(message.message);
    setEditMode(true);
    setEditMessageId(message.id);
  };

  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    if (socket) {
      socket.emit('typing', { name });
    }
  };

  useEffect(() => {
    const messageInputElement = document.getElementById('message-input');
    const nameInputElement = document.getElementById('name-input');

    const handleFocus = () => {
      socket.emit('feedback', {
        feedback: `✍️ ${nameInputElement.value} is typing a message`,
      });
    };

    const handleKeypress = () => {
      socket.emit('feedback', {
        feedback: `✍️ ${nameInputElement.value} is typing a message`,
      });
    };

    messageInputElement.addEventListener('focus', handleFocus);
    messageInputElement.addEventListener('keypress', handleKeypress);

    return () => {
      messageInputElement.removeEventListener('focus', handleFocus);
      messageInputElement.removeEventListener('keypress', handleKeypress);
    };
  }, [socket]);

  return (
    <div className="chat-app">
      <h1 className="title">Mr.Expense 💰</h1>
      <div className="main">
        <div className="name">
          <span><i className="far fa-user"></i></span>
          <input
            type="text"
            id="name-input"
            className="name-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              localStorage.setItem('chatAppName', e.target.value);
            }}
            maxLength="20"
          />
        </div>

        <ul className="message-container">
          {messages.map((msg, index) => {
            const isOwnMessage = msg.isOwnMessage;
            const alignment = index % 2 === 0 ? 'left' : 'right';
            const messageStyle = {
              display: 'inline-block',
              padding: '10px',
              borderRadius: '10px',
              maxWidth: '60%',
              marginBottom: '5px',
              marginRight:'10px',
              marginleft:'10px',
              backgroundColor: isOwnMessage ? '#e1ffc7' : '#f1f0f0',
              alignSelf: alignment === 'left' ? 'flex-start' : 'flex-end',
              textAlign: alignment
            };

            return (
              <li key={index} style={{ textAlign: alignment }}>
                <p style={messageStyle}>
                  {msg.message}
                  <span style={{ display: 'block', fontSize: '0.8em', color: '#555' }}>
                    {msg.name} ● {moment(msg.dateTime).fromNow()}
                  </span>
                  {isOwnMessage && (
                    <div style={{ display: 'inline-block', marginTop: '5px' }}>
                      <button 
                        style={{ color: 'green', display: 'inline-block', marginRight: '5px', background: 'none', border: 'none', cursor: 'pointer' }} 
                        className="edit-button" 
                        onClick={() => editMessage(msg)}
                      >
                        Edit
                      </button>
                      <button 
                        style={{ display: 'inline-block', background: 'none', border: 'none', cursor: 'pointer', color: 'red' }} 
                        className="delete-button" 
                        onClick={() => deleteMessage(msg.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </p>
              </li>
            );
          })}
          {feedback && (
            <li className="message-feedback">
              <p className="feedback">{feedback}</p>
            </li>
          )}
          <div ref={messageEndRef}></div>
        </ul>

        <form className="message-form" onSubmit={sendMessage}>
          <input
            type="text"
            name="message"
            id="message-input"
            className="message-input"
            value={messageInput}
            onChange={handleTyping}
          />
          <div className="v-divider"></div>
          <button type="submit" className="send-button">
            {editMode ? 'Update' : 'Send'} <span><i className="fas fa-paper-plane"></i></span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatApp;
